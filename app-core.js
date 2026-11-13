// 🌟 [크로스플랫폼 호환성 패치: 구형 iOS/iPadOS Safari & Android WebView용 roundRect 폴리필] 🌟
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    let r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? (radii[0] || 0) : 0);
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

/**
 * Graph Master Web - Application Controller & High-DPI Multi-Graph Canvas Renderer
 * (file:// 더블 클릭 및 로컬 웹 서버 환경 100% 무결점 호환)
 */

class GraphApp {
  constructor() {
    this.canvas = document.getElementById('graphCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 전역 엔진 참조
    this.engine = window.GraphMathEngine;
    this.meta = window.FUNC_METADATA;

    // 🌟 [테마별 곡선 색상 팔레트] 🌟
    // 화이트/밝은 배경: 데스모스(Desmos) 표준 클래식 고대비 색상군
    this.lightColorPalette = [
      '#c74440', // 데스모스 레드
      '#2d70b3', // 데스모스 블루
      '#388c46', // 데스모스 그린
      '#6042a6', // 데스모스 퍼플
      '#fa7e19', // 데스모스 앰버 오렌지
      '#008080', // 딥 틸
      '#b83280', // 마젠타
      '#1e293b'  // 딥 슬레이트
    ];
    // 다크/칠판 배경: 형광 & 네온 계열로 어두운 칠판 위 시인성 극대화
    this.darkColorPalette = [
      '#00d2d3', // 1: 민트 시안
      '#feca57', // 2: 골드 옐로우
      '#ff6b6b', // 3: 코랄 레드
      '#a29bfe', // 4: 바이올렛
      '#1dd1a1', // 5: 에메랄드 그린
      '#54a0ff', // 6: 스카이 블루
      '#ff9ff3', // 7: 라벤더 핑크
      '#ff9f43', // 8: 오렌지
      '#48dbfb', // 9: 네온 블루
      '#f368e0', // 10: 핫 핑크
      '#10ac84', // 11: 딥 민트
      '#ee5253'  // 12: 크림슨 레드
    ];
    // 기본 자동 배색 순환 배열 (축이 검정이므로 1:빨강, 2:파랑, 3:초록, 4:보라 4색을 기본 순서로 설정)
    this.defaultAutoColorSequence = [
      '#c74440', // 1: 빨강
      '#2d70b3', // 2: 파랑
      '#388c46', // 3: 초록
      '#6042a6'  // 4: 보라
    ];
    this.autoColorSequence = [...this.defaultAutoColorSequence];
    this.graphColorMode = 'auto';
    this.fixedGraphColor = '#1e293b';
    this.defaultGraphLineWidth = 2.8;
    try {
      const savedMode = localStorage.getItem('graphly_graph_color_mode_v1');
      if (savedMode === 'fixed' || savedMode === 'auto') this.graphColorMode = savedMode;
      const savedFixedColor = localStorage.getItem('graphly_fixed_graph_color_v1');
      if (savedFixedColor) this.fixedGraphColor = savedFixedColor;
      const savedAutoSeqRaw = localStorage.getItem('graphly_auto_color_seq_v1');
      if (savedAutoSeqRaw) {
        const parsedSeq = JSON.parse(savedAutoSeqRaw);
        if (Array.isArray(parsedSeq) && parsedSeq.length > 0) {
          const validSeq = parsedSeq.filter(c => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c));
          if (validSeq.length > 0) this.autoColorSequence = validSeq;
        }
      }
      const savedDefaultLw = parseFloat(localStorage.getItem('graphly_default_graph_lw_v1'));
      if (Number.isFinite(savedDefaultLw) && savedDefaultLw >= 1.0 && savedDefaultLw <= 6.0) {
        this.defaultGraphLineWidth = parseFloat(savedDefaultLw.toFixed(1));
      }
    } catch (e) { }
    this.colorPalette = [...this.autoColorSequence];

    // 🌟 [테마별 필기 잉크 팔레트 (5색)] 🌟
    this.lightInkPalette = [
      '#1e293b', // 차콜 블랙 (기본)
      '#2563eb', // 로열 블루
      '#dc2626', // 딥 레드
      '#16a34a', // 포레스트 그린
      '#7c3aed'  // 바이올렛
    ];
    this.darkInkPalette = [
      '#ffffff', // 분필 화이트 (기본)
      '#feca57', // 골드 옐로우
      '#ff6b6b', // 코랄 핑크
      '#54a0ff', // 스카이 블루
      '#00d2d3'  // 민트 시안
    ];

    // [다중 그래프 레이어 배열 - 시작 시 빈 레이어]
    this.graphs = [];
    this.activeGraphIdx = -1; // 선택된 그래프 없음 (빈 화면 시작)

    // 인터랙션 상태
    this.draggedHandleIdx = null; // 활성 그래프의 드래그 핸들 인덱스
    this.selectedHandleIdx = null; // 방향키 미세조정 핸들 인덱스
    this.pulseAnimId = null;
    this.downInfo = null;

    // 곡선 몸통(선) 터치 & 평행이동 상태
    this.isCurveSelected = false;
    this.isDraggingCurve = false;
    this.curveDragStart = null;
    this.curveHandlesSnapshot = null;

    // [↺ 실행 취소 / ↻ 다시 실행 (Undo & Redo) 히스토리 스택 엔진]
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 45;
    this.isHistoryProcessing = false;
    this._preDragState = null;

    // [🧲 사차함수 좌우대칭 자석 스냅 상태]
    this.symmetrySnapActive = false;
    this.symmetrySnapY = 0;

    // 공통 뷰포트 & 렌더링 옵션
    this.showAxes = true; // [대표님 기획]: 흰바탕에 가운데 수직선(축)과 그리드가 있는 상태에서 시작! (데스모스/지오지브라 스타일)
    this.showXAxis = true; // x축 개별 표시 여부 (기본 ON, 설정에서 x축/y축 독립 제어)
    this.showYAxis = true; // y축 개별 표시 여부 (기본 ON, 설정에서 x축/y축 독립 제어)
    this.axisLineWidth = 1.8; // 🌟 [대표님 피드백 반영]: 데스모스급 샤프하고 세련된 기본 축 두께 (기존 2.8px -> 1.8px)
    this.showArrows = true; // 수학적 표준 상시 고정
    this.showAsymptotes = true;
    this.showGuides = false; // 기본값: 점선 그리드 없음 (개형 중심 시각화)
    this.showGridNumbers = false; // 그리드 눈금 숫자 표시 옵션 (기본 OFF, 설정에서 ON 가능)
    this.showInverseGuide = false; // y = x 항등직선 대칭 기준선 (역함수 모드)
    this.zoomLevel = 1.0;
    this.targetZoom = 1.0;               // 피그마급 스무스 줌 수렴 목표치
    this._isZoomAnimating = false;
    this._zoomMousePos = null;
    this.panOffset = { x: 0, y: 0 };

    // 수학 좌표계 기본 범위 & 1:1 정비율 (Equal Aspect Ratio)
    this.xSpan = 8.5; // 대표님 요청: 극점/교점/변곡점이 시원하게 다 들어오는 확장 화각!
    this.ySpan = 6.0;
    this.lockAspect = true; // 수학적 1:1 정비율 (창 크기에 무관한 엄밀 개형 보존)

    // [📷 교재 삽입 캡처영역 & 저장 규격 엔진]
    this.useViewfinder = false; // 캡처영역 프레임 기본 OFF
    this.vfAspect = 4 / 3;     // 기본 4:3 교재 표준 비율
    this.vfAspectName = '4:3';
    this.vfScreenW = 680;      // 캡처영역 화면 고정 픽셀 가로 크기 (황금 여백 자동 도출)
    this.vfTargetWIn = 3.0;    // 출력 규격: 가로 3.0 in (약 7.6 cm, 교재 1단 표준)
    this.exportDPI = 300;      // 기본 300 DPI 초고화질
    this.hasInitializedVf = false;

    // 캡처영역 마우스 인터랙션 & 스마트 센터 스냅 상태
    this.isResizingVf = false;
    this.vfResizeStart = null;
    this.snapActiveX = false; // X축(세로선) 스마트 센터 스냅 활성 여부
    this.snapActiveY = false; // Y축(가로선) 스마트 센터 스냅 활성 여부

    // [🧲 스마트 마그네틱 자석 스냅 엔진 (극점·대칭점·점근선 축 스냅)]
    this.useMagneticSnap = true; // 기본 활성화 (쫀득한 손맛!)
    this.axisSnapActiveX = false; // Y축(x=0) 마그네틱 스냅 발동 여부
    this.axisSnapActiveY = false; // X축(y=0) 마그네틱 스냅 발동 여부
    this.snappedPoints = [];      // 스냅 발동된 특징점 좌표 목록 ({x, y, label})

    // [⚡ 실시간 교점판독기: 실근/접점 개수 판독 & 화면 밖 추적 엔진]
    this.useIntersectionDetector = false; // 기본 OFF (원터치 가동)
    this.detectedIntersections = [];      // 실시간 검출된 교점 목록
    this.intersectionAnimPhase = 0;       // 반짝거리는 펄스 애니메이션 위상
    this.intersectionAnimId = null;       // 펄스 애니메이션 루프 ID

    // [✂️ 캔버스 직관적 N-구간 다중 분할 (Canvas Multi-Boundary Piecewise) 엔진]
    this.usePiecewise = false;        // 기본 OFF
    this.piecewiseBoundaries = [];    // 정렬된 세로선 x좌표 배열: [0.0] or [-1.0, 2.0] 등
    this.piecewiseFuncMap = [];       // 각 구간별 담당 그래프 인덱스: [0, 1] or [0, 1, 2]
    this.piecewiseInclusions = [];    // 각 세로선 경계점의 포함 방향: 'right' (x>=b) 또는 'left' (x<=b)
    this.showPiecewiseGhost = false;  // 잘린 구간 고스트 점선 (기본 OFF로 화면 깔끔!)
    this.activePwDragIdx = null;      // 캔버스에서 드래그 중인 세로선 인덱스
    this.selectedPwBoundaryIdx = null;// 키보드 방향키(←, →)로 미세조정 중인 선택된 세로선 인덱스
    this.pwBoundaryBadges = [];       // 세로선 상단 배지 및 삭제 버튼 히트 정보
    this.pwRegionBadges = [];         // 각 구간 상단 함수 선택 칩 히트 정보
    this.isPiecewisePeriodic = false; // 🔁 전구간 주기 반복 활성화 플래그 (기본 OFF)
    this.periodicStepY = 0.0;         // 🪜 주기마다 y축 계단식 상승/하강: f(x+T) = f(x) + q (기본 0)
    this.pwPeriodBracketBadge = null; // 상단 전주기 브래킷 UI 히트 영역
    this.pwK = 0.0;                   // 단일 분할 레거시 호환
    this.pwA = -1.0;                  // 사잇구간 레거시 호환
    this.pwB = 1.0;
    this.piecewiseMode = 'multi';

    // [✨ 클린 뷰 / 판서 모드 (단축키 H)]
    this.isCleanView = false;         // 핸들·가이드라인·보조선 완전 숨김 모드

    // [📄 흑백 모드 (Monochrome / Textbook Mode): 원클릭 배경흰색 + 모든 선/축/글자 검은색 (단축키 M)]
    this.isMonochromeMode = false;
    this.preMonoThemeKey = null;

    // [✍️ 실시간 무한 칠판 필기 & 주석 (Live Handwriting & Infinite Annotation Engine, 단축키 P)]
    this.isInkMode = false;              // 실시간 필기 모드 활성 여부
    this.activeInkTool = 'pen';          // 'select' | 'pen' | 'highlighter' | 'eraser' | 'lasso'
    this.currentInkColor = '#1e293b'; // 화이트 페이퍼 기본 차콜 블랙    // 기본 화이트 잉크
    this.savedPenColor = '#1e293b';      // 🖊️ 펜 전용 기억 색상 (기본: 차콜 블랙)
    this.savedHighlighterColor = '#1e293b'; // 🖍️ 형광펜 전용 기억 색상 (기본: #1e293b ➔ 노란 형광펜 발색)
    this.currentInkSize = 4.2;           // 기본 4.2px
    this.currentHighlighterSize = 16;    // 기본 16px (형광펜 크기)
    this.currentEraserSize = 14;         // 기본 14px (지우개 크기)
    this.inkPenStyle = 'ballpen';        // 필기 펜 스타일 ('ballpen' | 'flat' | 'fountain' | 'brush')
    this.inkSoftBlur = 0.0;              // 아이캔스크린 스타일 모퉁이 보정 & 소프트 외곽 블러 강도 (0.0 ~ 5.0)
    try {
      const savedPenCol = localStorage.getItem('graphly_pen_color_v1');
      if (savedPenCol && /^#[0-9a-fA-F]{3,8}$/.test(savedPenCol)) {
        this.savedPenColor = savedPenCol;
        this.currentInkColor = savedPenCol;
      }
      const savedHlCol = localStorage.getItem('graphly_highlighter_color_v1');
      if (savedHlCol && /^#[0-9a-fA-F]{3,8}$/.test(savedHlCol)) {
        this.savedHighlighterColor = savedHlCol;
      }
      const savedPenStyle = localStorage.getItem('graphly_ink_pen_style_v1');
      if (savedPenStyle && ['ballpen', 'flat', 'fountain', 'brush'].includes(savedPenStyle)) {
        this.inkPenStyle = savedPenStyle;
      }
      const savedSoftBlur = parseFloat(localStorage.getItem('graphly_ink_soft_blur_v1'));
      if (!isNaN(savedSoftBlur) && savedSoftBlur >= 0 && savedSoftBlur <= 5.0) {
        this.inkSoftBlur = parseFloat(savedSoftBlur.toFixed(1));
      }
    } catch (err) { }
    this.inkStrokes = [];                // 저장된 모든 필기 획 배열 [{id, tool, color, size, isHighlighter, points: [{x, y, p}]}]
    this.currentInkStroke = null;        // 현재 드로잉 중인 획
    this.isDrawingInk = false;           // 필기 드로잉 중 플래그
    this.isSpacePressed = false;         // 스페이스바 팬 이동 감지
    this.isShiftPressed = false;         // Shift 키 팬 이동 감지 (대표님 기획: 필기 모드에서도 Shift 드래그로 화면 이동!)

    // 🌟 [초고속 144Hz 2-레이어 오프스크린 잉크 베이킹 엔진 & 씬 프리즈 캐시 (iCanScreen 급 0ms 저지연)] 🌟
    this.inkBakeCanvas = document.createElement('canvas');
    this.inkBakeCtx = this.inkBakeCanvas.getContext('2d');
    this.inkGraphBakeCanvas = document.createElement('canvas');
    this.inkGraphBakeCtx = this.inkGraphBakeCanvas.getContext('2d');
    this._inkBakeDirty = true;
    this.sceneFreezeCanvas = document.createElement('canvas');
    this.sceneFreezeCtx = this.sceneFreezeCanvas.getContext('2d');
    this._hasSceneFreeze = false;

    // [🖊️ 액정타블렛 / 아이패드 / 전자칠판 맞춤형: 가상 스타일러스 펜 & 지우개 포인터 표시 상태]
    // - 아이패드·태블릿(직접 화면에 펜을 대는 기기): 기본값 OFF (false)
    // - PC·액정타블렛(마우스/펜 호버 기기): 기본값 ON (true)
    // - 환경 설정(⚙️)의 [펜 포인터 표시] 스위치로 언제든 켜고 끌 수 있으며 localStorage에 보존됨
    this.stylusPenPos = { x: 300, y: 300 }; // 마지막 펜/마우스 좌표 (화면에서 멀어져도 보존)
    this.isStylusDrawing = false;           // 펜으로 화면을 누르고 글씨를 쓰는 중 플래그
    const _uaStr = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const _isDirectTouchTablet = /iPad|iPhone|iPod|Android/i.test(_uaStr) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.showVirtualStylus = !_isDirectTouchTablet;
    try {
      const savedStylusPref = localStorage.getItem('graphly_show_virtual_stylus_v1');
      if (savedStylusPref === 'true') this.showVirtualStylus = true;
      else if (savedStylusPref === 'false') this.showVirtualStylus = false;
    } catch (err) { }

    // 🎙️ 녹음 볼륨 (마이크 수음 감도 & 출력 음량: 20% ~ 150%, 기본 100%)
    this.audioRecordVolume = 100;
    try {
      const savedRecVol = parseInt(localStorage.getItem('graphly_audio_record_volume_v1'), 10);
      if (Number.isFinite(savedRecVol) && savedRecVol >= 20 && savedRecVol <= 150) {
        this.audioRecordVolume = Math.round(savedRecVol / 5) * 5;
      }
    } catch (err) { }

    // [🪢 올가미(Lasso) 선택 & 풀이 이동 툴 상태]
    this.isLassoSelecting = false;       // 올가미 루프 드로잉 중 플래그
    this.lassoPoints = [];               // 올가미 화면 좌표 루프 [{x, y}]
    this.selectedInkStrokes = [];        // 선택된 획 객체 참조 배열
    this.selectedTextLabels = [];        // 선택된 텍스트 라벨 객체 참조 배열
    this.lassoBoundingBox = null;        // 선택 바운딩 박스 {minX, maxX, minY, maxY, width, height}
    this.isDraggingLassoSelection = false; // 선택된 획 드래그 이동 플래그
    this.lassoDragStart = null;          // 드래그 시작 좌표 {screenX, screenY, m: {x, y}}
    this.isResizingLassoSelection = false; // 선택된 영역 모서리 크기 조절 플래그
    this.lassoResizeStart = null;          // 크기 조절 시작 스냅샷
    this.boardPaperType = 'blank';         // 칠판 배경 속지 ('blank' | 'grid' | 'lined' | 'dot')
    try {
      const savedPaper = localStorage.getItem('graphly_board_paper_v1');
      if (savedPaper && ['blank', 'grid', 'lined', 'dot'].includes(savedPaper)) {
        this.boardPaperType = savedPaper;
      }
    } catch (err) { }
    this.canvasRect = null;              // 레이아웃 스래싱 방지용 캔버스 BoundingClientRect 캐시

    // [📑 닥줌형 PDF 교재 뷰어 & 2단 문제 박스 크롭 엔진 상태]
    this.pdfDoc = null;                  // PDFDocumentProxy 인스턴스
    this.pdfFileName = '교재.pdf';       // 불러온 PDF 파일명
    this.pdfCurrentPage = 1;             // 현재 표시 중인 페이지 (1-based)
    this.pdfTotalPages = 1;              // 총 페이지 수
    this.pdfZoom = 1.25;                 // PDF 뷰포트 확대 배율
    this.isPdfModalOpen = false;         // PDF 모달 표출 상태
    this.isPdfCropModeActive = false;    // ✂️ 크롭 토글 활성화 여부
    this.isPdfCropping = false;          // PDF 크롭 드래그 중 플래그
    this.pdfCropStart = null;            // 크롭 드래그 시작 좌표
    this.cropTargetWrapper = null;       // 크롭 대상 페이지 래퍼 요소
    this.cropTargetPageNum = 1;          // 크롭 대상 페이지 번호
    this.pdfPageRenderStates = {};       // 페이지별 렌더링 상태 캐시
    this.problemCardData = null;         // 현재 칠판에 고정된 문제 카드 {imgUrl, pageNum}
    this.extraProblemCards = [];         // 추가로 소환된 다중 문제 카드 목록
    this.problemCardBaseX = 72;          // 문제 카드 기본 X 좌표
    this.problemCardBaseY = 68;          // 문제 카드 기본 Y 좌표
    this.isProblemCardMinimized = false; // 문제 카드 접힘/펼침 상태
    this.compactGraphStage = null;       // [📐 칠판 일체형 경계선 없는 정사각형 컴팩트 스테이지 {x, y, w, h, isCustomized}]
    this.isResizingStage = false;        // 컴팩트 스테이지 우하단 크기 조절 중 플래그
    this.isMovingStage = false;          // 컴팩트 스테이지 위치 이동 중 플래그
    this.stageDragStart = null;          // 스테이지 드래그 시작 상태
    this.savedProblemCardViewState = null; // [문제 접기 시 대화면 확장 & 복원용 상태 저장 {panX, panY, zoomLevel}]

    // [🎨 칠판 / 바탕색 테마 엔진: 기본 초록 칠판]
    this.canvasThemes = {
      chalkboard: { name: '초록 칠판', bg: '#003333', axis: '#ffffff', grid: 'rgba(255, 255, 255, 0.16)', vfBorder: 'rgba(255, 255, 255, 0.15)', isLight: false },
      dark_charcoal: { name: '다크 차콜', bg: '#1e272e', axis: '#ffffff', grid: 'rgba(255, 255, 255, 0.10)', vfBorder: 'rgba(255, 255, 255, 0.12)', isLight: false },
      white_paper: { name: '화이트 페이퍼', bg: '#ffffff', axis: '#2d3436', grid: 'rgba(0, 0, 0, 0.085)', vfBorder: 'rgba(0, 0, 0, 0.18)', isLight: true },
      deep_black: { name: '딥 블랙', bg: '#080808', axis: '#ffffff', grid: 'rgba(255, 255, 255, 0.08)', vfBorder: 'rgba(255, 255, 255, 0.12)', isLight: false },
      postit: { name: '포스트잇', bg: '#fef7e0', axis: '#2d3436', grid: 'rgba(0, 0, 0, 0.07)', vfBorder: 'rgba(0, 0, 0, 0.16)', isLight: true }
    };
    this.currentThemeKey = 'white_paper'; // [대표님 기획]: 기본 테마 화이트 페이퍼 (데스모스 스타일)!
    this._currentCat = 'tab_basic';      // 선택된 프리셋 탭 ('tab_basic' | 'tab_calculus' | '⭐ 내 그래프')
    this._squarePresetThumbCache = {};   // 1:1 정사각형 개형 SVG 메모이제이션 캐시

    // 뷰포트 오프셋 (팬 이동)
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // 🌟 [칠판 전체 무한 캔버스 이동 & 판서 전용 독립 줌 (Infinite Blackboard Pan & Board-Only Zoom)] 🌟
    this.boardPanX = 0;
    this.boardPanY = 0;
    this.boardZoom = 1.0;
    this.boardZoomOffsetX = 0;
    this.boardZoomOffsetY = 0;
    this.isBoardPanning = false;
    this.boardPanStart = { x: 0, y: 0 };
    this.activePointers = new Map();

    // [📍 교재 보조 수선(Drop Lines) & 축 좌표 라벨 시스템]
    this.dropLines = [];               // 생성된 보조 수선 배열
    this.isDropLineMode = false;       // 보조 수선 도구 활성 여부 (단축키 D)
    this.dropLineStyle = 'dashed';     // 'dashed' | 'solid'
    this.dropLineFontFamily = 'stix';  // 'stix' | 'pretendard' | 'batang'
    this.dropLineFontSize = 15;        // 기본 15 pt
    this.dropLineHoverCandidate = null;// 마우스 근처 자석 스냅 후보점 {x, y, name}
    this.dropLineHoverScissors = null; // 호버 중인 가위 버튼 {id, which}
    this.dropLineHoverLabel = null;    // 호버 중인 좌표 라벨 {id, which}
    this.activeEditingLabel = null;    // 인라인 편집 중인 라벨 {id, which}
    this.renderedScissors = [];        // 현재 프레임 렌더링된 가위 버튼 히트테스트 목록
    this.renderedDropLineLabels = [];  // 현재 프레임 렌더링된 좌표 라벨 바운딩박스 목록
    this.dropLineInputEl = document.getElementById('dropLineLabelInput');

    // [🔤 캔버스 자유 수식 텍스트 라벨 (함수 이름표 & 축 이름표)]
    this.textLabels = [];              // 생성된 자유 수식 텍스트 라벨 배열 [{id, mathX, mathY, text, fontSize, ...}]
    this.isTextToolMode = false;       // 텍스트 도구 활성 여부 (단축키 T)
    this.textLabelFontSize = 20;       // 자유 텍스트 기본 20 pt (확장 범위: 12~52 pt)
    this.showAxisLabels = false;       // 대표님 기획: 기본 축 이름표 (x, y, O) 자동 표시 여부 (기본값: false / 체크 해제)
    this.axisLabelFontSize = 22;       // 축 이름표 폰트 크기 기본 22 pt (확장 범위: 12~48 pt)
    this.axisLabelX = 'x';             // 기본 가로축 이름표 (t, k 등 변경 가능)
    this.axisLabelY = 'y';             // 기본 세로축 이름표
    this.activeEditingTextId = null;   // 인라인 편집 중인 텍스트 라벨 ID
    this.isDraggingTextLabel = false;  // 텍스트 라벨 드래그 이동 상태
    this.draggedTextLabelId = null;
    this.draggedTextOffset = { dx: 0, dy: 0 };
    this.renderedTextLabels = [];      // 렌더링된 텍스트 바운딩 박스 목록
    this.lastTextClickTime = 0;        // 더블클릭 판별용 타임스탬프
    this.canvasTextInputEl = document.getElementById('canvasTextInput');
    this.isTextEditingJustStarted = false; // 텍스트 생성 직후 찰나의 blur 방어 플래그

    this.isGraphCovered = true; // 🌟 [대표님 기획]: 첫 시작 화면(기본 본진)은 깨끗한 무지 판서 모드로 시작!
    this._graphSessionArchived = false;
    this._suspendedPdfBoardState = null;
    this._isTempPdfProblemCard = false;
    this.isPdfToGraphCropMode = false;
    this.isPdfToGraphCropDragging = false;

    this.lessonPlaylistSlides = [];
    this.lessonPlaylistIndex = 0;
    this.isLessonPlaylistActive = false;
    this.lessonTeachingMode = null; // null (미정) | 'crop' (문제 캡처 모드) | 'page' (PDF 페이지 모드)
    this.boardStickers = [];
    this.problemCardStickers = [];
    this.graphCardStickers = [];
    this.isDrawingSticker = false;
    this.stickerDraftStart = null;
    this.stickerDraftCurrent = null;
    this._pendingStickerTap = null;
    this._tappingBoardSticker = null;
    this._hoveredBoardStickerId = null;
    this.cloudUser = null;
    this.myLibraryCache = [];
    this.communityHubCache = [];

    // 👑 [구독(Pro) vs 비구독(Free) 개수 제한 컨트롤 타워 & ⭐ 내 그래프 보관함 초기화]
    this.initCustomGraphPresets();

    this.initDOM();
    this.initShareModal();
    this.initCloudHubAndPlaylist();
    this.initShortcutCustomization();
    this.initNAxisStudioModal();
    this.bindEvents();
    this.resizeCanvas();
    this.checkUrlHashForState();
    this.render();
  }

  // 현재 활성 그래프 getter (없으면 null 반환)
  get activeGraph() {
    if (this.activeGraphIdx >= 0 && this.activeGraphIdx < this.graphs.length) {
      return this.graphs[this.activeGraphIdx];
    }
    return this.graphs[0] || null;
  }

  initDOM() {
    this.renderLayerList();
    this.renderFuncList();
    this.bindControls();
    this.initHistoryControls();
    this.initPiecewiseControls();
    this.initShapeControls();
    this.initCurveContextBar();
    this.initRailDrawer();
    this.initDropLineControls();
    this.initTextLabelControls();
    this.initMonochromeControls();
    this.initInkControls();
    this.initLassoActionBar();
    this.initBoardPaperControls();
    this.initAudioSyncControls();
    this.initPdfEngine();
    this.initWelcomeSplash();
    this.initStylusFastTap();
    if (!this.isInkMode) {
      this.toggleInkMode(true);
    }
    this.setActiveInkTool('pen');
    this.syncControls();
    this.syncWorkspaceModeUI();
    this.syncGraphSnapBarUI();
  }

  // --- [🎯 UI 순정 클릭 보호 & 롱프레스/손날 오터치/호버 관리] ---
  initStylusFastTap() {
    if (this._stylusFastTapInitialized) return;
    this._stylusFastTapInitialized = true;

    const TOOLBAR_CONTAINER_SELECTOR = [
      '.rail-dock',
      '.canvas-quick-toolbar',
      '.ink-floating-toolbar',
      '.lasso-action-floating-bar',
      '.quick-pill-remote',
      '.curve-context-bar',
      '.problem-card-header',
      '.problem-card-actions',
      '.pdf-modal-header',
      '.graph-snap-floating-bar',
      '.audio-sync-floating-bar'
    ].join(', ');

    const isEditableInput = (el) => {
      if (!el || typeof el.closest !== 'function') return false;
      return Boolean(el.closest('input, textarea, select, [contenteditable="true"], .ink-size-preview-row'));
    };

    const isTextInputEl = (el) => {
      if (!el || typeof el.closest !== 'function') return false;
      const inp = el.closest('input, textarea, select, [contenteditable="true"]');
      if (!inp) return false;
      if (inp.tagName === 'INPUT' && ['range', 'checkbox', 'radio', 'button', 'color', 'file'].includes((inp.type || '').toLowerCase())) {
        return false;
      }
      return true;
    };

    // 1) 비입력 영역 우클릭/롱프레스/드래그/텍스트선택 기본 제스처 차단
    const blockNativeLongPressGesture = (e) => {
      if (isEditableInput(e.target)) return;
      e.preventDefault();
    };
    ['contextmenu', 'selectstart', 'dragstart', 'MSHoldVisual', 'MSGestureHold'].forEach(evtName => {
      window.addEventListener(evtName, blockNativeLongPressGesture, { capture: true, passive: false });
      document.addEventListener(evtName, blockNativeLongPressGesture, { capture: true, passive: false });
    });

    // 2) 아이패드 펜슬 필기 중 손날(touch)이 하단/우측 플로팅 툴바를 스칠 때의 오터치만 선택 차단 (순정 click/scroll 100% 보존)
    window.addEventListener('pointerdown', (e) => {
      if (
        e.pointerType === 'touch' &&
        e.target &&
        typeof e.target.closest === 'function' &&
        (
          (this.isDrawingInk && this._activeDrawingPointerType === 'pen') ||
          (this._isDrawingCardInk && this._hasDetectedStylusPen) ||
          (this._lastPenActiveTime && (Date.now() - this._lastPenActiveTime < 500))
        )
      ) {
        if (e.target.closest(TOOLBAR_CONTAINER_SELECTOR)) {
          if (e.cancelable !== false) e.preventDefault();
          e.stopPropagation();
        }
      }
    }, { capture: true, passive: false });

    // 3) 버튼 클릭 후 포커스 잔류로 인해 스페이스바 패닝 시 직전 버튼이 눌리는 현상 방지
    window.addEventListener('click', () => {
      if (document.activeElement && document.activeElement !== document.body && !isTextInputEl(document.activeElement)) {
        try { document.activeElement.blur(); } catch (err) { }
      }
    }, { capture: true, passive: true });

    // 4) PC 마우스 & 애플펜슬 공중 호버링 지원 + 터치 직후 Sticky :hover 잔상 제거
    const HOVER_ICON_SELECTOR = '.rail-btn, .quick-fab-btn, .rail-zoom-action-btn';
    let currentHoveredIcon = null;
    let suppressHoverUntil = 0;

    const clearHoveredIcon = () => {
      if (currentHoveredIcon) {
        currentHoveredIcon.classList.remove('is-hovered');
        currentHoveredIcon = null;
      }
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || (e.buttons && e.buttons !== 0) || performance.now() < suppressHoverUntil) {
        clearHoveredIcon();
        return;
      }
      const target = e.target;
      const btn = (target && typeof target.closest === 'function')
        ? target.closest(HOVER_ICON_SELECTOR)
        : null;
      if (btn === currentHoveredIcon) return;
      clearHoveredIcon();
      if (btn && !btn.disabled) {
        currentHoveredIcon = btn;
        btn.classList.add('is-hovered');
      }
    }, { capture: true, passive: true });

    window.addEventListener('pointerdown', () => {
      suppressHoverUntil = performance.now() + 280;
      clearHoveredIcon();
    }, { capture: true, passive: true });

    window.addEventListener('pointerup', () => {
      suppressHoverUntil = performance.now() + 280;
      clearHoveredIcon();
    }, { capture: true, passive: true });

    window.addEventListener('pointercancel', clearHoveredIcon, { capture: true, passive: true });
    window.addEventListener('touchstart', () => {
      suppressHoverUntil = performance.now() + 350;
      clearHoveredIcon();
    }, { capture: true, passive: true });
    window.addEventListener('blur', clearHoveredIcon);
  }

  // --- [🌟 초기 인트로 화면 제거: 접속/앱 실행 즉시 0.0초 만에 판서 모드로 직행 (우측 전체화면 버튼은 그대로 유지)] ---
  initWelcomeSplash() {
    const splash = document.getElementById('welcomeSplash');
    const btnStart = document.getElementById('btnStartApp');
    if (splash) {
      splash.classList.add('dismissed');
      splash.style.display = 'none';
    }
    if (btnStart) {
      btnStart.onclick = () => {
        if (splash) {
          splash.classList.add('dismissed');
          splash.style.display = 'none';
        }
      };
    }
  }

  // --- [🔤 캔버스 자유 수식 텍스트 라벨 & 축 이름 컨트롤러 초기화] ---
  initTextLabelControls() {
    const btnQuick = document.getElementById('btnQuickText');
    if (btnQuick) {
      btnQuick.onclick = () => this.toggleTextToolMode();
    }

    // 기본 축 이름표 (x, y, O) 자동 표시 체크박스 (기본값: 체크 해제)
    const chkAxis = document.getElementById('chkShowAxisLabels');
    const subPanelAxis = document.getElementById('axisLabelsSubPanel');
    const sliderAxisFSize = document.getElementById('sliderAxisLabelSize');
    const lblAxisFSize = document.getElementById('lblAxisLabelSize');

    if (chkAxis) {
      chkAxis.checked = Boolean(this.showAxisLabels);
      if (subPanelAxis) subPanelAxis.style.display = this.showAxisLabels ? 'block' : 'none';
      chkAxis.onchange = (e) => {
        this.pushHistoryState();
        this.showAxisLabels = e.target.checked;
        if (subPanelAxis) subPanelAxis.style.display = this.showAxisLabels ? 'block' : 'none';
        this.render();
        this.showToast(this.showAxisLabels ? '📍 기본 축 이름표 (x, y, O) 켜짐' : '📍 기본 축 이름표 (x, y, O) 숨김');
      };
    }

    if (sliderAxisFSize) {
      sliderAxisFSize.value = this.axisLabelFontSize || 22;
      if (lblAxisFSize) lblAxisFSize.textContent = `${sliderAxisFSize.value}`;
      sliderAxisFSize.oninput = (e) => {
        this.setAxisLabelFontSize(parseInt(e.target.value, 10));
      };
    }

    const btnAxisDown = document.getElementById('btnAxisLabelSizeDown');
    const btnAxisUp = document.getElementById('btnAxisLabelSizeUp');
    if (btnAxisDown) {
      btnAxisDown.onclick = () => {
        const nextSize = Math.max(12, (this.axisLabelFontSize || 22) - 2);
        this.setAxisLabelFontSize(nextSize);
      };
    }
    if (btnAxisUp) {
      btnAxisUp.onclick = () => {
        const nextSize = Math.min(48, (this.axisLabelFontSize || 22) + 2);
        this.setAxisLabelFontSize(nextSize);
      };
    }

    const inAxisX = document.getElementById('inputAxisNameX');
    if (inAxisX) {
      inAxisX.value = this.axisLabelX || 'x';
      inAxisX.oninput = (e) => {
        this.axisLabelX = e.target.value;
        this.render();
      };
    }

    const inAxisY = document.getElementById('inputAxisNameY');
    if (inAxisY) {
      inAxisY.value = this.axisLabelY || 'y';
      inAxisY.oninput = (e) => {
        this.axisLabelY = e.target.value;
        this.render();
      };
    }

    const sliderSize = document.getElementById('sliderTextLabelSize');
    const lblSize = document.getElementById('lblTextLabelSize');
    if (sliderSize) {
      sliderSize.value = this.textLabelFontSize || 20;
      if (lblSize) lblSize.textContent = `${sliderSize.value}`;
      sliderSize.oninput = (e) => {
        this.setTextLabelFontSize(parseInt(e.target.value, 10));
      };
    }

    const btnTextDown = document.getElementById('btnTextLabelSizeDown');
    const btnTextUp = document.getElementById('btnTextLabelSizeUp');
    if (btnTextDown) {
      btnTextDown.onclick = () => {
        const nextSize = Math.max(12, (this.textLabelFontSize || 20) - 2);
        this.setTextLabelFontSize(nextSize);
      };
    }
    if (btnTextUp) {
      btnTextUp.onclick = () => {
        const nextSize = Math.min(52, (this.textLabelFontSize || 20) + 2);
        this.setTextLabelFontSize(nextSize);
      };
    }

    const btnClear = document.getElementById('btnClearTextLabels');
    if (btnClear) {
      btnClear.onclick = () => this.clearAllTextLabels();
    }

    // 캔버스 텍스트 인라인 입력창 이벤트
    const input = document.getElementById('canvasTextInput');
    if (input) {
      this.canvasTextInputEl = input;

      // 인라인 입력창 클릭/드래그 시 캔버스나 부모로 이벤트가 전파되어 포커스가 풀리지 않도록 원천 차단
      input.addEventListener('pointerdown', (e) => e.stopPropagation());
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('dblclick', (e) => e.stopPropagation());

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.commitEditingTextLabel();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEditingTextLabel();
        }
      });
      input.addEventListener('blur', () => {
        // [핵심]: 캔버스 클릭 직후 생성 과정에서 브라우저 mousedown/focus 전환으로 인한 찰나의 blur는 무시하고 포커스 복원!
        if (this.isTextEditingJustStarted) {
          setTimeout(() => {
            if (this.activeEditingTextId && input.style.display !== 'none') {
              input.focus();
            }
          }, 15);
          return;
        }
        setTimeout(() => {
          if (this.activeEditingTextId && !this.isTextEditingJustStarted) {
            this.commitEditingTextLabel();
          }
        }, 120);
      });
    }
  }

  // --- [📍 교재 보조 수선 & 축 좌표 라벨 컨트롤러 초기화] ---
  initDropLineControls() {
    const btnQuick = document.getElementById('btnQuickDropLine');
    if (btnQuick) {
      btnQuick.onclick = () => this.toggleDropLineMode();
    }

    const selFont = document.getElementById('selMathFont');
    if (selFont) {
      selFont.value = this.dropLineFontFamily || 'stix';
      selFont.onchange = (e) => {
        this.dropLineFontFamily = e.target.value;
        this.render();
      };
    }

    const btnDashed = document.getElementById('btnDropLineDashed');
    const btnSolid = document.getElementById('btnDropLineSolid');
    if (btnDashed && btnSolid) {
      btnDashed.onclick = () => {
        this.dropLineStyle = 'dashed';
        btnDashed.classList.add('active');
        btnSolid.classList.remove('active');
        this.render();
      };
      btnSolid.onclick = () => {
        this.dropLineStyle = 'solid';
        btnSolid.classList.add('active');
        btnDashed.classList.remove('active');
        this.render();
      };
    }

    const sliderFontSize = document.getElementById('sliderDropLineFontSize');
    const lblFontSize = document.getElementById('lblDropLineFontSize');
    if (sliderFontSize) {
      sliderFontSize.value = this.dropLineFontSize || 15;
      if (lblFontSize) lblFontSize.textContent = `${sliderFontSize.value}`;
      sliderFontSize.oninput = (e) => {
        this.setDropLineFontSize(parseInt(e.target.value, 10));
      };
    }

    const btnDropLineDown = document.getElementById('btnDropLineSizeDown');
    const btnDropLineUp = document.getElementById('btnDropLineSizeUp');
    if (btnDropLineDown) {
      btnDropLineDown.onclick = () => {
        const nextSize = Math.max(11, (this.dropLineFontSize || 15) - 1);
        this.setDropLineFontSize(nextSize);
      };
    }
    if (btnDropLineUp) {
      btnDropLineUp.onclick = () => {
        const nextSize = Math.min(22, (this.dropLineFontSize || 15) + 1);
        this.setDropLineFontSize(nextSize);
      };
    }

    const btnClear = document.getElementById('btnClearDropLines');
    if (btnClear) {
      btnClear.onclick = () => this.clearAllDropLines();
    }

    // 인라인 라벨 에디터 키보드 및 포커스 이벤트 바인딩
    const input = document.getElementById('dropLineLabelInput');
    if (input) {
      this.dropLineInputEl = input;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.commitEditingDropLineLabel();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEditingDropLineLabel();
        }
      });
      input.addEventListener('blur', () => {
        // 클릭 중인 다른 요소(가위 등)와의 순서 보장을 위해 짧은 타이머 후 커밋
        setTimeout(() => {
          if (this.activeEditingLabel) {
            this.commitEditingDropLineLabel();
          }
        }, 120);
      });
    }
  }

  // --- [↺ 실행 취소 & ↻ 다시 실행 (Undo / Redo) 히스토리 스택 엔진] ---
  initHistoryControls() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const btnQuickUndo = document.getElementById('btnQuickUndo');
    const btnQuickRedo = document.getElementById('btnQuickRedo');

    if (btnUndo) btnUndo.onclick = () => this.undo();
    if (btnRedo) btnRedo.onclick = () => this.redo();
    if (btnQuickUndo) btnQuickUndo.onclick = () => this.undo();
    if (btnQuickRedo) btnQuickRedo.onclick = () => this.redo();
    this.updateUndoRedoUI();
  }

  getHistorySnapshot() {
    return JSON.stringify({
      graphs: this.graphs,
      activeGraphIdx: this.activeGraphIdx,
      zoomLevel: this.zoomLevel,
      panX: this.panX,
      panY: this.panY,
      boardPanX: this.boardPanX || 0,
      boardPanY: this.boardPanY || 0,
      boardZoom: this.boardZoom || 1.0,
      boardZoomOffsetX: this.boardZoomOffsetX || 0,
      boardZoomOffsetY: this.boardZoomOffsetY || 0,
      xSpan: this.xSpan,
      ySpan: this.ySpan,
      showAxes: Boolean(this.showAxes),
      showXAxis: this.showXAxis !== false,
      showYAxis: this.showYAxis !== false,
      showGuides: Boolean(this.showGuides),
      showGridNumbers: Boolean(this.showGridNumbers),
      usePiecewise: this.usePiecewise,
      piecewiseBoundaries: this.piecewiseBoundaries,
      piecewiseFuncMap: this.piecewiseFuncMap,
      piecewiseInclusions: this.piecewiseInclusions,
      isPiecewisePeriodic: this.isPiecewisePeriodic,
      periodicStepY: this.periodicStepY,
      isPiecewiseLocked: Boolean(this.isPiecewiseLocked),
      showInverseGuide: this.showInverseGuide,
      dropLines: this.dropLines,
      textLabels: this.textLabels,
      axisLabelX: this.axisLabelX,
      axisLabelY: this.axisLabelY,
      showAxisLabels: this.showAxisLabels,
      axisLabelFontSize: this.axisLabelFontSize,
      textLabelFontSize: this.textLabelFontSize,
      inkStrokes: this.inkStrokes,
      boardStickers: this.boardStickers
    });
  }

  _captureFullWorkspaceSnapshot() {
    const pWidget = document.getElementById('problemCardWidget');
    const pImg = document.getElementById('problemCardImg');
    const pTitle = document.getElementById('problemCardTitle');
    const pToggle = document.getElementById('iconCardToggle');
    const hasPrimaryProblem = Boolean(pWidget && this.problemCardData && !this._retainedPdfAudioProbCard);

    const gWidget = document.getElementById('graphCardWidget');
    const gBody = document.getElementById('graphCardBody');
    const gImg = document.getElementById('graphCardImg');
    const gTitle = document.getElementById('graphCardTitle');
    const gToggle = document.getElementById('iconGraphCardToggle');
    const hasPrimaryGraph = Boolean(gWidget && this._hasPrimaryGraphCard && this.graphCardData);
    let livePrimarySnap = null;
    if (hasPrimaryGraph && typeof this._getMutablePipCardSnapshot === 'function') {
      livePrimarySnap = this._getMutablePipCardSnapshot('primary');
      if (livePrimarySnap) {
        const cw = Math.max(160, Math.round(parseFloat(gWidget.style.width) || (gBody && gBody.clientWidth) || 430));
        const ch = Math.max(60, Math.round((gBody && parseFloat(gBody.style.height)) || (cw * (this.graphCardAspect || 0.82))));
        livePrimarySnap._isPipCardSnapshot = true;
        livePrimarySnap._pipCardW = cw;
        livePrimarySnap._pipCardH = ch;
        this._savePipCardSnapshot('primary', livePrimarySnap);
      }
    }

    const extraProblemCardStates = (this.extraProblemCards || []).map(c => ({
      left: (c && c.el) ? c.el.style.left : '',
      top: (c && c.el) ? c.el.style.top : '',
      width: (c && c.el) ? c.el.style.width : '',
      transform: (c && c.el) ? c.el.style.transform : '',
      zIndex: (c && c.el) ? c.el.style.zIndex : '',
      display: (c && c.el) ? (c.el.style.display || 'flex') : 'flex',
      minimized: Boolean(c && c.el && c.el.classList.contains('minimized')),
      cardInkActive: Boolean(c && c.el && c.el.classList.contains('card-ink-active')),
      pipLocked: Boolean(c && c.el && c.el.classList.contains('pip-locked-mode')),
      pipStealth: Boolean(c && c.el && c.el.classList.contains('pip-stealth-locked')),
      baseX: c ? c.baseX : 0,
      baseY: c ? c.baseY : 0,
      pdfAnchor: (c && c.el && c.el._pdfAnchor) ? { ...c.el._pdfAnchor } : null,
      strokes: JSON.parse(JSON.stringify((c && c.el && c.el._cardInkStrokes) || [])),
      stickers: JSON.parse(JSON.stringify((c && c.el && c.el._cardStickers) || []))
    }));

    const extraGraphCardStates = (this.extraGraphCards || []).map(c => {
      let liveExtraSnap = null;
      const bodyEl = (c && c.el) ? c.el.querySelector('.problem-card-body') : null;
      if (c && typeof this._getMutablePipCardSnapshot === 'function') {
        liveExtraSnap = this._getMutablePipCardSnapshot(c);
        if (liveExtraSnap) {
          const cw = Math.max(160, Math.round((c.el && parseFloat(c.el.style.width)) || (bodyEl && bodyEl.clientWidth) || 430));
          const ch = Math.max(60, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cw * (c.aspect || 0.82))));
          liveExtraSnap._isPipCardSnapshot = true;
          liveExtraSnap._pipCardW = cw;
          liveExtraSnap._pipCardH = ch;
          this._savePipCardSnapshot(c, liveExtraSnap);
        }
      }
      return {
        left: (c && c.el) ? c.el.style.left : '',
        top: (c && c.el) ? c.el.style.top : '',
        width: (c && c.el) ? c.el.style.width : '',
        bodyHeight: bodyEl ? bodyEl.style.height : '',
        transform: (c && c.el) ? c.el.style.transform : '',
        zIndex: (c && c.el) ? c.el.style.zIndex : '',
        display: (c && c.el) ? (c.el.style.display || 'flex') : 'flex',
        minimized: Boolean(c && c.el && c.el.classList.contains('minimized')),
        cardInkActive: Boolean(c && c.el && c.el.classList.contains('card-ink-active')),
        baseX: c ? c.baseX : 0,
        baseY: c ? c.baseY : 0,
        aspect: c ? c.aspect : 0.82,
        graphSnapshot: c ? c.graphSnapshot : null,
        pipSnapClone: liveExtraSnap ? JSON.parse(JSON.stringify(liveExtraSnap)) : null,
        pdfAnchor: (c && c.el && c.el._pdfAnchor) ? { ...c.el._pdfAnchor } : null,
        strokes: JSON.parse(JSON.stringify((c && c.el && c.el._cardInkStrokes) || [])),
        stickers: JSON.parse(JSON.stringify((c && c.el && c.el._cardStickers) || []))
      };
    });

    return {
      historyJson: this.getHistorySnapshot(),
      primaryProblemCard: hasPrimaryProblem ? {
        display: pWidget.style.display,
        minimized: pWidget.classList.contains('minimized'),
        cardInkActive: pWidget.classList.contains('card-ink-active'),
        pipLocked: pWidget.classList.contains('pip-locked-mode'),
        pipStealth: pWidget.classList.contains('pip-stealth-locked'),
        left: pWidget.style.left,
        top: pWidget.style.top,
        width: pWidget.style.width,
        transform: pWidget.style.transform,
        zIndex: pWidget.style.zIndex,
        imgSrc: pImg ? pImg.src : '',
        titleText: pTitle ? pTitle.textContent : '',
        toggleText: pToggle ? pToggle.textContent : '▾',
        problemCardData: this.problemCardData ? { ...this.problemCardData } : null,
        problemCardImage: this.problemCardImage,
        problemCardAspect: this.problemCardAspect,
        isProblemCardMinimized: this.isProblemCardMinimized,
        problemCardBaseX: this.problemCardBaseX,
        problemCardBaseY: this.problemCardBaseY,
        pdfAnchor: pWidget._pdfAnchor ? { ...pWidget._pdfAnchor } : null,
        problemInkStrokes: JSON.parse(JSON.stringify(this.problemInkStrokes || [])),
        problemCardStickers: JSON.parse(JSON.stringify(this.problemCardStickers || []))
      } : null,
      extraProblemCards: [...(this.extraProblemCards || [])],
      extraProblemCardStates,
      primaryGraphCard: hasPrimaryGraph ? {
        display: gWidget.style.display,
        minimized: gWidget.classList.contains('minimized'),
        cardInkActive: gWidget.classList.contains('card-ink-active'),
        left: gWidget.style.left,
        top: gWidget.style.top,
        width: gWidget.style.width,
        bodyHeight: gBody ? gBody.style.height : '',
        transform: gWidget.style.transform,
        zIndex: gWidget.style.zIndex,
        imgSrc: gImg ? gImg.src : '',
        titleText: gTitle ? gTitle.textContent : '',
        toggleText: gToggle ? gToggle.textContent : '▾',
        graphCardData: this.graphCardData ? { ...this.graphCardData } : null,
        graphCardImage: this.graphCardImage,
        graphCardAspect: this.graphCardAspect,
        isGraphCardMinimized: this.isGraphCardMinimized,
        graphCardBaseX: this.graphCardBaseX,
        graphCardBaseY: this.graphCardBaseY,
        primaryGraphCardSnapshot: this.primaryGraphCardSnapshot,
        pipSnapClone: livePrimarySnap ? JSON.parse(JSON.stringify(livePrimarySnap)) : null,
        graphCardPdfAnchor: this.graphCardPdfAnchor ? { ...this.graphCardPdfAnchor } : null,
        pdfAnchor: gWidget._pdfAnchor ? { ...gWidget._pdfAnchor } : null,
        graphInkStrokes: JSON.parse(JSON.stringify(this.graphInkStrokes || [])),
        graphCardStickers: JSON.parse(JSON.stringify(this.graphCardStickers || []))
      } : null,
      extraGraphCards: [...(this.extraGraphCards || [])],
      extraGraphCardStates,
      graphCaseCounter: this._graphCaseCounter || 0,
      isGraphCovered: Boolean(this.isGraphCovered),
      coveredGraphStateBackup: this._coveredGraphStateBackup ? JSON.parse(JSON.stringify(this._coveredGraphStateBackup)) : null,
      savedLayer2BoardPan: this._savedLayer2BoardPan ? { ...this._savedLayer2BoardPan } : null,
      pdfPageBoardData: this.pdfPageBoardData ? { ...this.pdfPageBoardData } : null,
      pdfSavedPageStates: this.pdfSavedPageStates ? { ...this.pdfSavedPageStates } : {},
      pdfWorkedPages: Array.isArray(this.pdfWorkedPages) ? [...this.pdfWorkedPages] : [],
      isLessonPlaylistActive: Boolean(this.isLessonPlaylistActive),
      lessonPlaylistSlides: Array.isArray(this.lessonPlaylistSlides) ? JSON.parse(JSON.stringify(this.lessonPlaylistSlides)) : [],
      lessonPlaylistIndex: this.lessonPlaylistIndex || 0,
      suspendedPdfBoardState: this._suspendedPdfBoardState ? { ...this._suspendedPdfBoardState } : null,
      isTempPdfProblemCard: Boolean(this._isTempPdfProblemCard),
      graphSessionArchived: Boolean(this._graphSessionArchived)
    };
  }

  _restoreFullWorkspaceSnapshot(wsSnap) {
    if (!wsSnap) return;
    this.restoreHistorySnapshot(wsSnap.historyJson);

    // 1. 기본 문제 카드 복원 또는 숨김
    const pWidget = document.getElementById('problemCardWidget');
    const pImg = document.getElementById('problemCardImg');
    const pTitle = document.getElementById('problemCardTitle');
    const pToggle = document.getElementById('iconCardToggle');
    if (wsSnap.primaryProblemCard && pWidget) {
      const pc = wsSnap.primaryProblemCard;
      this.problemCardData = pc.problemCardData ? { ...pc.problemCardData } : null;
      const isEvictedCanvasImg = Boolean(
        pc.problemCardImage &&
        typeof pc.problemCardImage.getContext === 'function' &&
        (pc.problemCardImage._evicted || pc.problemCardImage.width <= 4 || pc.problemCardImage.height <= 4)
      );
      this.problemCardImage = isEvictedCanvasImg ? null : pc.problemCardImage;
      this.problemCardAspect = pc.problemCardAspect;
      this.isProblemCardMinimized = Boolean(pc.isProblemCardMinimized);
      this.problemCardBaseX = pc.problemCardBaseX;
      this.problemCardBaseY = pc.problemCardBaseY;
      pWidget._pdfAnchor = pc.pdfAnchor ? { ...pc.pdfAnchor } : null;
      this.problemInkStrokes = JSON.parse(JSON.stringify(pc.problemInkStrokes || []));
      this.problemCardStickers = JSON.parse(JSON.stringify(pc.problemCardStickers || []));
      if (typeof pWidget._renderCardStickers === 'function') pWidget._renderCardStickers();
      const safePcImgSrc = (typeof this._sanitizeCardImageUrl === 'function')
        ? this._sanitizeCardImageUrl(pc.imgSrc || '')
        : (pc.imgSrc || '');
      if (pImg) pImg.src = safePcImgSrc;
      if (pTitle) pTitle.textContent = pc.titleText || '문제';
      if (pToggle) pToggle.textContent = pc.toggleText || '▾';
      pWidget.classList.toggle('minimized', Boolean(pc.minimized));
      pWidget.classList.toggle('card-ink-active', Boolean(pc.cardInkActive));
      pWidget.classList.add('pip-locked-mode');
      pWidget.classList.toggle('pip-stealth-locked', Boolean(pc.pipStealth && !pc.cardInkActive && !pc.minimized));
      if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(pWidget);
      if (
        typeof this.scheduleProblemCardStealth === 'function' &&
        pWidget.classList.contains('pip-locked-mode') &&
        !pWidget.classList.contains('pip-stealth-locked') &&
        !pWidget.classList.contains('minimized')
      ) {
        this.scheduleProblemCardStealth(pWidget, 3000);
      }
      const pLaserBtn = pWidget.querySelector('.btn-card-laser');
      if (pLaserBtn) pLaserBtn.classList.toggle('active', Boolean(pc.cardInkActive));
      pWidget.style.left = pc.left || '72px';
      pWidget.style.top = pc.top || '18px';
      pWidget.style.width = pc.width || '520px';
      pWidget.style.transform = pc.transform || '';
      if (pc.zIndex) pWidget.style.zIndex = pc.zIndex;
      pWidget.style.display = pc.display || 'flex';
      this.syncProblemCardRectFromWidget();
      this.renderProblemCardCanvas();
    } else {
      this.closeProblemCard();
    }

    // 2. 다중 추가 문제 카드 복원
    const targetExtraProblems = wsSnap.extraProblemCards || [];
    const targetExtraProbStates = wsSnap.extraProblemCardStates || [];
    if (this.extraProblemCards && this.extraProblemCards.length > 0) {
      this.extraProblemCards.forEach(c => {
        if (c && c.el && !targetExtraProblems.includes(c)) {
          if (typeof this._hibernateDetachedCardCanvases === 'function') {
            this._hibernateDetachedCardCanvases(c.el);
          }
          c.el.remove();
        }
      });
    }
    this.extraProblemCards = [...targetExtraProblems];
    const extraProbParent = (this.canvas && this.canvas.parentElement) || document.body;
    this.extraProblemCards.forEach((c, idx) => {
      if (c && c.el) {
        if (!extraProbParent.contains(c.el)) {
          extraProbParent.appendChild(c.el);
        }
        const st = targetExtraProbStates[idx];
        if (st) {
          c.baseX = st.baseX;
          c.baseY = st.baseY;
          c.el._pdfAnchor = st.pdfAnchor ? { ...st.pdfAnchor } : null;
          c.el._cardInkStrokes = JSON.parse(JSON.stringify(st.strokes || []));
          c.el._cardStickers = JSON.parse(JSON.stringify(st.stickers || []));
          if (st.left) c.el.style.left = st.left;
          if (st.top) c.el.style.top = st.top;
          if (st.width) c.el.style.width = st.width;
          c.el.style.transform = st.transform || '';
          if (st.zIndex) c.el.style.zIndex = st.zIndex;
          c.el.style.display = st.display || 'flex';
          c.el.classList.toggle('minimized', Boolean(st.minimized));
          c.el.classList.toggle('card-ink-active', Boolean(st.cardInkActive));
          c.el.classList.add('pip-locked-mode');
          c.el.classList.toggle('pip-stealth-locked', Boolean(st.pipStealth && !st.cardInkActive && !st.minimized));
          if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(c.el);
          if (
            typeof this.scheduleProblemCardStealth === 'function' &&
            c.el.classList.contains('pip-locked-mode') &&
            !c.el.classList.contains('pip-stealth-locked') &&
            !c.el.classList.contains('minimized')
          ) {
            this.scheduleProblemCardStealth(c.el, 3000);
          }
          const lBtn = c.el.querySelector('.btn-card-laser');
          if (lBtn) lBtn.classList.toggle('active', Boolean(st.cardInkActive));
          if (typeof c.el._renderCardStickers === 'function') c.el._renderCardStickers();
          if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
        }
      }
    });

    // 3. 그래프 보관 카드 복원
    const gWidget = document.getElementById('graphCardWidget');
    const gBody = document.getElementById('graphCardBody');
    const gImg = document.getElementById('graphCardImg');
    const gTitle = document.getElementById('graphCardTitle');
    const gToggle = document.getElementById('iconGraphCardToggle');
    if (wsSnap.primaryGraphCard && gWidget) {
      const gc = wsSnap.primaryGraphCard;
      this.clearPipGraphCardStealthTimer('primary');
      this._hasPrimaryGraphCard = true;
      this.graphCardData = gc.graphCardData ? { ...gc.graphCardData } : null;
      this.graphCardImage = gc.graphCardImage;
      this.graphCardAspect = gc.graphCardAspect;
      this.isGraphCardMinimized = Boolean(gc.isGraphCardMinimized);
      this.graphCardBaseX = gc.graphCardBaseX;
      this.graphCardBaseY = gc.graphCardBaseY;
      this.primaryGraphCardSnapshot = gc.primaryGraphCardSnapshot;
      this.graphCardPdfAnchor = gc.graphCardPdfAnchor ? { ...gc.graphCardPdfAnchor } : null;
      gWidget._pdfAnchor = gc.pdfAnchor ? { ...gc.pdfAnchor } : null;
      gWidget._pipSnapObj = gc.pipSnapClone ? JSON.parse(JSON.stringify(gc.pipSnapClone)) : null;
      this.graphInkStrokes = JSON.parse(JSON.stringify(gc.graphInkStrokes || []));
      this.graphCardStickers = JSON.parse(JSON.stringify(gc.graphCardStickers || []));
      if (typeof gWidget._renderCardStickers === 'function') gWidget._renderCardStickers();
      const safeGcImgSrc = (typeof this._sanitizeCardImageUrl === 'function')
        ? this._sanitizeCardImageUrl(gc.imgSrc || '')
        : (gc.imgSrc || '');
      if (gImg) gImg.src = safeGcImgSrc;
      if (gTitle) gTitle.textContent = gc.titleText || '보관 그래프 #1';
      if (gToggle) gToggle.textContent = gc.toggleText || '▾';
      gWidget.classList.toggle('minimized', Boolean(gc.minimized));
      gWidget.classList.toggle('card-ink-active', Boolean(gc.cardInkActive));
      const gLaserBtn = gWidget.querySelector('.btn-card-laser');
      if (gLaserBtn) gLaserBtn.classList.toggle('active', Boolean(gc.cardInkActive));
      gWidget.style.left = gc.left || '580px';
      gWidget.style.top = gc.top || '68px';
      gWidget.style.width = gc.width || '430px';
      if (gBody && gc.bodyHeight) gBody.style.height = gc.bodyHeight;
      gWidget.style.transform = gc.transform || '';
      if (gc.zIndex) gWidget.style.zIndex = gc.zIndex;
      gWidget.style.display = gc.display || 'flex';
      gWidget._lastPipLockUiSig = '';
      this.syncGraphCardRectFromWidget();
      this.syncPipCardLockUI('primary');
      this.renderPipGraphCard('primary');
      this.renderGraphCardCanvas();
      if (gWidget.classList.contains('pip-locked-mode')) {
        this.schedulePipGraphCardStealth('primary', 3000);
      }
    } else {
      this.clearPipGraphCardStealthTimer('primary');
      this._hasPrimaryGraphCard = false;
      this.graphCardData = null;
      this.graphCardRect = null;
      this.graphCardPdfAnchor = null;
      if (gWidget) {
        gWidget._pdfAnchor = null;
        gWidget._pipSnapObj = null;
        gWidget.classList.remove('pip-manipulating', 'pip-locked-mode', 'pip-stealth-locked', 'card-ink-active');
        gWidget.style.display = 'none';
      }
      this.graphInkStrokes = [];
      this.renderGraphCardCanvas();
    }

    const targetExtraGraphs = wsSnap.extraGraphCards || [];
    const targetExtraGraphStates = wsSnap.extraGraphCardStates || [];
    if (this.extraGraphCards && this.extraGraphCards.length > 0) {
      this.extraGraphCards.forEach(c => {
        if (c && c.el && !targetExtraGraphs.includes(c)) {
          this.clearPipGraphCardStealthTimer(c);
          if (typeof this._hibernateDetachedCardCanvases === 'function') {
            this._hibernateDetachedCardCanvases(c.el);
          }
          c.el.remove();
        }
      });
    }
    this.extraGraphCards = [...targetExtraGraphs];
    const extraGraphParent = (this.canvas && this.canvas.parentElement) || document.body;
    this.extraGraphCards.forEach((c, idx) => {
      if (c && c.el) {
        if (!extraGraphParent.contains(c.el)) {
          extraGraphParent.appendChild(c.el);
        }
        const st = targetExtraGraphStates[idx];
        if (st) {
          c.baseX = st.baseX;
          c.baseY = st.baseY;
          c.aspect = st.aspect || c.aspect || 0.82;
          if (st.graphSnapshot) c.graphSnapshot = st.graphSnapshot;
          c._pipSnapObj = st.pipSnapClone ? JSON.parse(JSON.stringify(st.pipSnapClone)) : null;
          c.el._pdfAnchor = st.pdfAnchor ? { ...st.pdfAnchor } : null;
          c.el._cardInkStrokes = JSON.parse(JSON.stringify(st.strokes || []));
          c.el._cardStickers = JSON.parse(JSON.stringify(st.stickers || []));
          if (st.left) c.el.style.left = st.left;
          if (st.top) c.el.style.top = st.top;
          if (st.width) c.el.style.width = st.width;
          const bodyEl = c.el.querySelector('.problem-card-body');
          if (bodyEl && st.bodyHeight) bodyEl.style.height = st.bodyHeight;
          c.el.style.transform = st.transform || '';
          if (st.zIndex) c.el.style.zIndex = st.zIndex;
          c.el.style.display = st.display || 'flex';
          c.el.classList.toggle('minimized', Boolean(st.minimized));
          c.el.classList.toggle('card-ink-active', Boolean(st.cardInkActive));
          c.el.classList.toggle('pip-locked-mode', Boolean(st.pipLocked));
          c.el.classList.toggle('pip-stealth-locked', Boolean(st.pipStealth));
          if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(c.el);
          const lBtn = c.el.querySelector('.btn-card-laser');
          if (lBtn) lBtn.classList.toggle('active', Boolean(st.cardInkActive));
        }
        c.el._lastPipLockUiSig = '';
        this.syncPipCardLockUI(c);
        this.renderPipGraphCard(c);
        if (typeof c.el._renderCardStickers === 'function') c.el._renderCardStickers();
        if (typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
        if (c.el.classList.contains('pip-locked-mode')) {
          this.schedulePipGraphCardStealth(c, 3000);
        }
      }
    });

    this._graphCaseCounter = wsSnap.graphCaseCounter || 0;
    this.isGraphCovered = Boolean(wsSnap.isGraphCovered);
    this._coveredGraphStateBackup = wsSnap.coveredGraphStateBackup ? JSON.parse(JSON.stringify(wsSnap.coveredGraphStateBackup)) : null;
    this._savedLayer2BoardPan = wsSnap.savedLayer2BoardPan ? { ...wsSnap.savedLayer2BoardPan } : null;
    this.pdfPageBoardData = wsSnap.pdfPageBoardData ? { ...wsSnap.pdfPageBoardData } : null;
    if (this.pdfPageBoardData && typeof this._isValidPdfBoardCanvas === 'function' && !this._isValidPdfBoardCanvas(this.pdfPageBoardData.canvas)) {
      this.pdfPageBoardData.canvas = null;
      if (typeof this._ensurePdfBoardCanvasFromDataUrl === 'function') {
        this._ensurePdfBoardCanvasFromDataUrl(this.pdfPageBoardData);
      }
    }
    this.pdfSavedPageStates = wsSnap.pdfSavedPageStates ? { ...wsSnap.pdfSavedPageStates } : {};
    this.pdfWorkedPages = Array.isArray(wsSnap.pdfWorkedPages) ? [...wsSnap.pdfWorkedPages] : [];
    this.isLessonPlaylistActive = Boolean(wsSnap.isLessonPlaylistActive);
    this.lessonPlaylistSlides = Array.isArray(wsSnap.lessonPlaylistSlides) ? JSON.parse(JSON.stringify(wsSnap.lessonPlaylistSlides)) : [];
    this.lessonPlaylistIndex = wsSnap.lessonPlaylistIndex || 0;
    this._suspendedPdfBoardState = wsSnap.suspendedPdfBoardState ? { ...wsSnap.suspendedPdfBoardState } : null;
    this._isTempPdfProblemCard = Boolean(wsSnap.isTempPdfProblemCard);
    this._graphSessionArchived = Boolean(wsSnap.graphSessionArchived);

    this.updateProblemCardPosition();
    this.syncPdfBoardNavBarUI();
    this.syncLessonPlaylistNavBarUI();
    this.syncWorkspaceModeUI();
    this.syncGraphSnapBarUI();
    if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets' && this.isGraphCovered) {
      const curTarget = this._pipTargetCard;
      const stillValid = Boolean(
        (curTarget === 'primary' && this._hasPrimaryGraphCard && this.graphCardData) ||
        (curTarget && curTarget !== 'primary' && curTarget !== 'new' && Array.isArray(this.extraGraphCards) && this.extraGraphCards.includes(curTarget))
      );
      if (!stillValid) {
        this._pipTargetCard = 'new';
        this._pipSessionOrigin = 'rail';
        document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
        const btnPresets = document.getElementById('btnRailPresets');
        if (btnPresets) btnPresets.classList.add('active');
      }
    }
    this._inkBakeDirty = true;
    this.updateIntersections();
    this.render();
  }

  pushHistoryState() {
    if (this.isHistoryProcessing) return;
    const snap = this.getHistorySnapshot();
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snap) {
      return;
    }
    this.undoStack.push(snap);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoUI();
  }

  _pushWorkspaceUndoSnapshot(toastUndo = '↺ 이전 작업이 복구되었습니다', toastRedo = '↻ 다시 실행됨') {
    if (this.isHistoryProcessing) return;
    const fullSnap = this._captureFullWorkspaceSnapshot();
    this.undoStack.push({
      type: 'workspace_snapshot',
      snapshot: fullSnap,
      toastUndo,
      toastRedo
    });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoUI();
  }

  _resolveCardUndoStrokesArray(entry) {
    if (!entry) return null;
    if (entry.cardKind === 'problem') {
      if (!Array.isArray(this.problemInkStrokes)) this.problemInkStrokes = [];
      return this.problemInkStrokes;
    }
    if (entry.cardKind === 'graph') {
      if (!Array.isArray(this.graphInkStrokes)) this.graphInkStrokes = [];
      return this.graphInkStrokes;
    }
    if (entry.cardKind === 'extra' && entry.cardEl) {
      if (!Array.isArray(entry.cardEl._cardInkStrokes)) entry.cardEl._cardInkStrokes = [];
      return entry.cardEl._cardInkStrokes;
    }
    return Array.isArray(entry.strokesArr) ? entry.strokesArr : null;
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.showToast('ℹ️ 실행 취소할 이전 작업이 없습니다.');
      return;
    }
    this.isHistoryProcessing = true;
    const prevSnap = this.undoStack.pop();

    // 🌟 [새 캔버스 전체 초기화 / 그래프·문제 창 닫기 실행 취소: 문제 카드·보관 카드·그래프·필기 100% 원상 복구]
    if (typeof prevSnap === 'object' && prevSnap !== null && prevSnap.type === 'workspace_snapshot') {
      const currentFull = this._captureFullWorkspaceSnapshot();
      this.redoStack.push({
        type: 'workspace_snapshot',
        snapshot: currentFull,
        toastUndo: prevSnap.toastUndo,
        toastRedo: prevSnap.toastRedo
      });
      this._restoreFullWorkspaceSnapshot(prevSnap.snapshot);
      this._inkBakeDirty = true;
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
      this.showToast(prevSnap.toastUndo || '↺ 새 캔버스 초기화 이전 상태로 모두 복구됨');
      return;
    }

    // 🌟 [0ms 초고속 칠판/카드 가림막 스티커 실행 취소]
    if (typeof prevSnap === 'object' && prevSnap !== null && (prevSnap.type === 'sticker_add' || prevSnap.type === 'sticker_delete')) {
      if (!Array.isArray(this.boardStickers)) this.boardStickers = [];
      if (prevSnap.type === 'sticker_add') {
        const idx = this.boardStickers.indexOf(prevSnap.sticker);
        if (idx !== -1) this.boardStickers.splice(idx, 1);
      } else {
        this.boardStickers.push(prevSnap.sticker);
      }
      this.redoStack.push(prevSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.render();
      this.showToast('↺ 스티커 실행 취소됨');
      return;
    }
    if (typeof prevSnap === 'object' && prevSnap !== null && (prevSnap.type === 'card_sticker_add' || prevSnap.type === 'card_sticker_delete')) {
      const arr = prevSnap.stickersArr || this.getCardStickersArray(prevSnap.cardEl);
      if (Array.isArray(arr)) {
        if (prevSnap.type === 'card_sticker_add') {
          const idx = arr.indexOf(prevSnap.sticker);
          if (idx !== -1) arr.splice(idx, 1);
        } else {
          arr.push(prevSnap.sticker);
        }
      }
      if (typeof prevSnap.renderFn === 'function') prevSnap.renderFn();
      this.redoStack.push(prevSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.showToast('↺ 카드 스티커 실행 취소됨');
      return;
    }

    // 🌟 [0ms 초고속 카드 위 필기 획 단위 실행 취소]
    if (typeof prevSnap === 'object' && prevSnap !== null && prevSnap.type === 'card_stroke_add') {
      const targetArr = this._resolveCardUndoStrokesArray(prevSnap);
      if (Array.isArray(targetArr)) {
        let idx = targetArr.indexOf(prevSnap.stroke);
        if (idx === -1 && targetArr.length > 0 && prevSnap.stroke && prevSnap.stroke.points) {
          for (let k = targetArr.length - 1; k >= 0; k--) {
            const cand = targetArr[k];
            if (
              cand &&
              cand.points &&
              cand.points.length === prevSnap.stroke.points.length &&
              cand.color === prevSnap.stroke.color &&
              cand.points[0] &&
              prevSnap.stroke.points[0] &&
              cand.points[0].nx === prevSnap.stroke.points[0].nx &&
              cand.points[0].ny === prevSnap.stroke.points[0].ny
            ) {
              idx = k;
              break;
            }
          }
        }
        if (idx !== -1) targetArr.splice(idx, 1);
      }
      if (typeof prevSnap.renderFn === 'function') prevSnap.renderFn();
      this.redoStack.push(prevSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.showToast('↺ 카드 필기 실행 취소됨');
      return;
    }

    // 🌟 [0ms 초고속 카드 지우개 획 삭제 실행 취소]
    if (typeof prevSnap === 'object' && prevSnap !== null && prevSnap.type === 'card_strokes_erase') {
      const targetArr = this._resolveCardUndoStrokesArray(prevSnap);
      if (Array.isArray(targetArr) && Array.isArray(prevSnap.batches)) {
        for (let b = prevSnap.batches.length - 1; b >= 0; b--) {
          const batch = prevSnap.batches[b];
          if (!Array.isArray(batch)) continue;
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            if (!item || !item.stroke) continue;
            const insertIdx = Math.max(0, Math.min(targetArr.length, item.index));
            targetArr.splice(insertIdx, 0, item.stroke);
          }
        }
      }
      if (typeof prevSnap.renderFn === 'function') prevSnap.renderFn();
      this.redoStack.push(prevSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.showToast('↺ 지운 카드 필기 복구됨');
      return;
    }

    // 🌟 [0ms 초고속 잉크 획 단위 실행 취소]
    if (typeof prevSnap === 'object' && prevSnap !== null && prevSnap.type === 'stroke_add') {
      const idx = this.inkStrokes.indexOf(prevSnap.stroke);
      if (idx !== -1) {
        this.inkStrokes.splice(idx, 1);
      }
      this.redoStack.push(prevSnap);
      this._inkBakeDirty = true;
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.render();
      this.showToast('↺ 획 실행 취소됨');
      return;
    }

    // 🌟 [0ms 초고속 지우개 획 삭제 실행 취소]
    if (typeof prevSnap === 'object' && prevSnap !== null && prevSnap.type === 'strokes_erase') {
      if (!Array.isArray(this.inkStrokes)) this.inkStrokes = [];
      if (Array.isArray(prevSnap.batches)) {
        for (let b = prevSnap.batches.length - 1; b >= 0; b--) {
          const batch = prevSnap.batches[b];
          if (!Array.isArray(batch)) continue;
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            if (!item || !item.stroke) continue;
            const insertIdx = Math.max(0, Math.min(this.inkStrokes.length, item.index));
            this.inkStrokes.splice(insertIdx, 0, item.stroke);
          }
        }
      }
      this.redoStack.push(prevSnap);
      this._inkBakeDirty = true;
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
      this.render();
      this.showToast('↺ 지운 필기 복구됨');
      return;
    }

    const currentSnap = this.getHistorySnapshot();
    this.redoStack.push(currentSnap);
    this.restoreHistorySnapshot(prevSnap);
    this._inkBakeDirty = true;
    this.isHistoryProcessing = false;
    this.updateUndoRedoUI();
    this.showToast('↺ 실행 취소됨');
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.showToast('ℹ️ 다시 실행할 다음 작업이 없습니다.');
      return;
    }
    this.isHistoryProcessing = true;
    const nextSnap = this.redoStack.pop();

    // 🌟 [새 캔버스 전체 초기화 / 그래프·문제 창 닫기 다시 실행]
    if (typeof nextSnap === 'object' && nextSnap !== null && nextSnap.type === 'workspace_snapshot') {
      const currentFull = this._captureFullWorkspaceSnapshot();
      this.undoStack.push({
        type: 'workspace_snapshot',
        snapshot: currentFull,
        toastUndo: nextSnap.toastUndo,
        toastRedo: nextSnap.toastRedo
      });
      this._restoreFullWorkspaceSnapshot(nextSnap.snapshot);
      this._inkBakeDirty = true;
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
      this.showToast(nextSnap.toastRedo || '↻ 다시 실행됨');
      return;
    }

    // 🌟 [0ms 초고속 칠판/카드 가림막 스티커 다시 실행]
    if (typeof nextSnap === 'object' && nextSnap !== null && (nextSnap.type === 'sticker_add' || nextSnap.type === 'sticker_delete')) {
      if (!Array.isArray(this.boardStickers)) this.boardStickers = [];
      if (nextSnap.type === 'sticker_add') {
        this.boardStickers.push(nextSnap.sticker);
      } else {
        const idx = this.boardStickers.indexOf(nextSnap.sticker);
        if (idx !== -1) this.boardStickers.splice(idx, 1);
      }
      this.undoStack.push(nextSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.render();
      this.showToast('↻ 스티커 다시 실행됨');
      return;
    }
    if (typeof nextSnap === 'object' && nextSnap !== null && (nextSnap.type === 'card_sticker_add' || nextSnap.type === 'card_sticker_delete')) {
      const arr = nextSnap.stickersArr || this.getCardStickersArray(nextSnap.cardEl);
      if (Array.isArray(arr)) {
        if (nextSnap.type === 'card_sticker_add') {
          arr.push(nextSnap.sticker);
        } else {
          const idx = arr.indexOf(nextSnap.sticker);
          if (idx !== -1) arr.splice(idx, 1);
        }
      }
      if (typeof nextSnap.renderFn === 'function') nextSnap.renderFn();
      this.undoStack.push(nextSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.showToast('↻ 카드 스티커 다시 실행됨');
      return;
    }

    // 🌟 [0ms 초고속 카드 위 필기 획 단위 다시 실행]
    if (typeof nextSnap === 'object' && nextSnap !== null && nextSnap.type === 'card_stroke_add') {
      const targetArr = this._resolveCardUndoStrokesArray(nextSnap);
      if (Array.isArray(targetArr)) {
        targetArr.push(nextSnap.stroke);
      }
      if (typeof nextSnap.renderFn === 'function') nextSnap.renderFn();
      this.undoStack.push(nextSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.showToast('↻ 카드 필기 다시 실행됨');
      return;
    }

    // 🌟 [0ms 초고속 카드 지우개 획 삭제 다시 실행]
    if (typeof nextSnap === 'object' && nextSnap !== null && nextSnap.type === 'card_strokes_erase') {
      const targetArr = this._resolveCardUndoStrokesArray(nextSnap);
      if (Array.isArray(targetArr) && Array.isArray(nextSnap.batches)) {
        const toRemove = new Set();
        for (let b = 0; b < nextSnap.batches.length; b++) {
          const batch = nextSnap.batches[b];
          if (!Array.isArray(batch)) continue;
          for (let i = 0; i < batch.length; i++) {
            if (batch[i] && batch[i].stroke) toRemove.add(batch[i].stroke);
          }
        }
        if (toRemove.size > 0) {
          let writeIdx = 0;
          for (let i = 0; i < targetArr.length; i++) {
            const st = targetArr[i];
            if (!toRemove.has(st)) {
              targetArr[writeIdx++] = st;
            }
          }
          targetArr.length = writeIdx;
        }
      }
      if (typeof nextSnap.renderFn === 'function') nextSnap.renderFn();
      this.undoStack.push(nextSnap);
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.showToast('↻ 카드 필기 지우기 다시 실행됨');
      return;
    }

    // 🌟 [0ms 초고속 잉크 획 단위 다시 실행]
    if (typeof nextSnap === 'object' && nextSnap !== null && nextSnap.type === 'stroke_add') {
      this.inkStrokes.push(nextSnap.stroke);
      this.undoStack.push(nextSnap);
      this._inkBakeDirty = true;
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      this.render();
      this.showToast('↻ 획 다시 실행됨');
      return;
    }

    // 🌟 [0ms 초고속 지우개 획 삭제 다시 실행]
    if (typeof nextSnap === 'object' && nextSnap !== null && nextSnap.type === 'strokes_erase') {
      if (Array.isArray(this.inkStrokes) && Array.isArray(nextSnap.batches)) {
        const toRemove = new Set();
        for (let b = 0; b < nextSnap.batches.length; b++) {
          const batch = nextSnap.batches[b];
          if (!Array.isArray(batch)) continue;
          for (let i = 0; i < batch.length; i++) {
            if (batch[i] && batch[i].stroke) toRemove.add(batch[i].stroke);
          }
        }
        if (toRemove.size > 0) {
          this.inkStrokes = this.inkStrokes.filter(st => !toRemove.has(st));
        }
      }
      this.undoStack.push(nextSnap);
      this._inkBakeDirty = true;
      this.isHistoryProcessing = false;
      this.updateUndoRedoUI();
      if (this.isAudioRecording) this._recordAudioWorkspaceStateIfNeeded(true);
      this.render();
      this.showToast('↻ 지우기 다시 실행됨');
      return;
    }

    const currentSnap = this.getHistorySnapshot();
    this.undoStack.push(currentSnap);
    this.restoreHistorySnapshot(nextSnap);
    this._inkBakeDirty = true;
    this.isHistoryProcessing = false;
    this.updateUndoRedoUI();
    this.showToast('↻ 다시 실행됨');
  }

  restoreHistorySnapshot(jsonStr) {
    try {
      if (!jsonStr) return;
      const data = (typeof jsonStr === 'string') ? JSON.parse(jsonStr) : jsonStr;
      this.graphs = data.graphs || [];
      if (this.engine && typeof this.engine.ensureCompiledFunctions === 'function') {
        this.engine.ensureCompiledFunctions(this.graphs);
      }
      if (Array.isArray(this.graphs) && typeof window !== 'undefined' && window.SafeMathCompiler) {
        this.graphs.forEach(g => {
          if (g && g.type === 'general_expr' && Array.isArray(g.handles)) {
            g.handles.forEach(h => {
              if (h && typeof h.fn !== 'function') {
                const rawExpr = h.rawExpr || g.customExpr || '';
                if (rawExpr) {
                  const comp = window.SafeMathCompiler.compile(rawExpr);
                  if (comp && comp.success) {
                    h.fn = comp.fn;
                  }
                }
              }
            });
          }
        });
      }
      this.activeGraphIdx = data.activeGraphIdx !== undefined ? data.activeGraphIdx : -1;
      if (data.zoomLevel !== undefined) {
        this.zoomLevel = data.zoomLevel;
        const slZoom = document.getElementById('sliderZoom');
        if (slZoom) slZoom.value = this.zoomLevel;
        const lblZoom = document.getElementById('lblZoom');
        if (lblZoom) lblZoom.textContent = `${Math.round(this.zoomLevel * 100)}%`;
      }
      if (data.panX !== undefined) this.panX = data.panX;
      if (data.panY !== undefined) this.panY = data.panY;
      if (data.boardPanX !== undefined) this.boardPanX = data.boardPanX;
      if (data.boardPanY !== undefined) this.boardPanY = data.boardPanY;
      this.boardZoom = (typeof data.boardZoom === 'number') ? data.boardZoom : 1.0;
      this.boardZoomOffsetX = (typeof data.boardZoomOffsetX === 'number') ? data.boardZoomOffsetX : 0;
      this.boardZoomOffsetY = (typeof data.boardZoomOffsetY === 'number') ? data.boardZoomOffsetY : 0;
      if (data.xSpan !== undefined) this.xSpan = data.xSpan;
      if (data.ySpan !== undefined) this.ySpan = data.ySpan;
      if (data.showAxes !== undefined) {
        this.showAxes = Boolean(data.showAxes);
        this.updateAxesUI();
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
      const chkG = document.getElementById('chkGuides');
      if (chkG) chkG.checked = Boolean(this.showGuides);
      if (data.showGridNumbers !== undefined) {
        this.showGridNumbers = Boolean(data.showGridNumbers);
        const chkGN = document.getElementById('chkGridNumbers');
        if (chkGN) chkGN.checked = this.showGridNumbers;
      }
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
      if (data.isPiecewisePeriodic !== undefined) {
        this.isPiecewisePeriodic = data.isPiecewisePeriodic;
      }
      if (data.periodicStepY !== undefined) {
        this.periodicStepY = data.periodicStepY;
      }
      if (data.isPiecewiseLocked !== undefined) {
        this.isPiecewiseLocked = Boolean(data.isPiecewiseLocked);
      }
      if (!this._isApplyingAudioTimelineState) {
        const pwPop = document.getElementById('pwRegionPopover');
        if (pwPop) pwPop.style.display = 'none';
        this._openPwRegionIdx = null;
      }
      this.syncPeriodicUI();
      if (data.showInverseGuide !== undefined) {
        this.showInverseGuide = data.showInverseGuide;
        const chkInv = document.getElementById('chkInverseGuide');
        if (chkInv) chkInv.checked = this.showInverseGuide;
      }
      if (data.dropLines) {
        this.dropLines = JSON.parse(JSON.stringify(data.dropLines));
      } else {
        this.dropLines = [];
      }
      if (data.textLabels) {
        this.textLabels = JSON.parse(JSON.stringify(data.textLabels));
      } else {
        this.textLabels = [];
      }
      if (data.axisLabelX !== undefined) {
        this.axisLabelX = data.axisLabelX;
        const inX = document.getElementById('inputAxisNameX');
        if (inX) inX.value = this.axisLabelX;
      }
      if (data.axisLabelY !== undefined) {
        this.axisLabelY = data.axisLabelY;
        const inY = document.getElementById('inputAxisNameY');
        if (inY) inY.value = this.axisLabelY;
      }
      if (data.showAxisLabels !== undefined) {
        this.showAxisLabels = data.showAxisLabels;
        const chk = document.getElementById('chkShowAxisLabels');
        if (chk) chk.checked = this.showAxisLabels;
        const sub = document.getElementById('axisLabelsSubPanel');
        if (sub) sub.style.display = this.showAxisLabels ? 'block' : 'none';
      }
      if (data.axisLabelFontSize !== undefined) {
        this.axisLabelFontSize = data.axisLabelFontSize;
        const sl = document.getElementById('sliderAxisLabelSize');
        if (sl) sl.value = this.axisLabelFontSize;
        const lbl = document.getElementById('lblAxisLabelSize');
        if (lbl) lbl.textContent = `${this.axisLabelFontSize}`;
      }
      if (data.textLabelFontSize !== undefined) {
        this.textLabelFontSize = data.textLabelFontSize;
        const slText = document.getElementById('sliderTextLabelSize');
        if (slText) slText.value = this.textLabelFontSize;
        const lblText = document.getElementById('lblTextLabelSize');
        if (lblText) lblText.textContent = `${this.textLabelFontSize}`;
      }
      if (data.inkStrokes) {
        this.inkStrokes = JSON.parse(JSON.stringify(data.inkStrokes));
      } else {
        this.inkStrokes = [];
      }
      if (Array.isArray(data.boardStickers)) {
        this.boardStickers = JSON.parse(JSON.stringify(data.boardStickers));
      } else {
        this.boardStickers = [];
      }
      this._inkBakeDirty = true;

      this.selectedHandleIdx = null;
      this.isCurveSelected = this.graphs.length > 0;
      this.syncControls();
      this.renderLayerList();
      this.renderFuncList();
      this.render();
    } catch (e) {
      console.error('History restore error:', e);
    }
  }

  updateUndoRedoUI() {
    const canUndo = this.undoStack.length > 0;
    const canRedo = this.redoStack.length > 0;
    const stateBits = (canUndo ? 2 : 0) | (canRedo ? 1 : 0);
    if (this._lastUndoRedoUiBits === stateBits) {
      return;
    }
    this._lastUndoRedoUiBits = stateBits;

    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    const btnQuickUndo = document.getElementById('btnQuickUndo');
    const btnQuickRedo = document.getElementById('btnQuickRedo');

    const undoTitle = '실행 취소';
    const redoTitle = '다시 실행';

    if (btnUndo) {
      btnUndo.disabled = !canUndo;
      btnUndo.title = undoTitle;
    }
    if (btnRedo) {
      btnRedo.disabled = !canRedo;
      btnRedo.title = redoTitle;
    }
    if (btnQuickUndo) {
      btnQuickUndo.disabled = !canUndo;
      btnQuickUndo.title = undoTitle;
    }
    if (btnQuickRedo) {
      btnQuickRedo.disabled = !canRedo;
      btnQuickRedo.title = redoTitle;
    }
  }

  // --- [다중 그래프 레이어 관리 UI] ---
  renderLayerList() {
    const list = document.getElementById('graphLayerList');
    if (!list) return;
    list.innerHTML = '';

    const countLbl = document.getElementById('lblGraphCount');
    if (countLbl) countLbl.textContent = this.graphs.length;

    if (this.graphs.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'empty-layer-hint';
      emptyHint.style.cssText = 'padding: 10px 8px; font-size: 11px; color: var(--text-muted); text-align: center; border: 1px dashed rgba(255,255,255,0.12); border-radius: var(--radius-sm); margin: 4px 0;';
      emptyHint.innerHTML = '그래프 없음';
      list.appendChild(emptyHint);
    } else {
      this.graphs.forEach((g, idx) => {
        const item = document.createElement('div');
        item.className = `layer-item ${(this.isCurveSelected && idx === this.activeGraphIdx) ? 'active' : ''}`;

        const left = document.createElement('div');
        left.className = 'layer-left';

        const dot = document.createElement('span');
        dot.className = 'layer-dot';
        dot.style.backgroundColor = g.color;
        dot.style.color = g.color;

        const title = document.createElement('span');
        title.className = 'layer-title';
        title.textContent = `f${idx + 1}(x)`;

        const badge = document.createElement('span');
        badge.className = 'layer-badge';
        const baseBadgeName = this.meta[g.type]?.name || '도형';
        badge.textContent = g.isTransposedYX ? `${baseBadgeName} (y=x)` : baseBadgeName;

        left.appendChild(dot);
        left.appendChild(title);
        left.appendChild(badge);
        item.appendChild(left);

        const rightTools = document.createElement('div');
        rightTools.style.cssText = 'display: flex; align-items: center; gap: 3px;';

        // 구간 분할 모드 활성 시: '구간 참여' vs '독립 곡선' 원클릭 토글 뱃지
        if (this.usePiecewise && this.graphs.length >= 2) {
          const roleBtn = document.createElement('button');
          const isIndep = Boolean(g.isIndependent || g.isTransposedYX);
          roleBtn.className = `btn-layer-role ${isIndep ? 'independent' : 'piecewise'}`;
          roleBtn.textContent = isIndep ? '🌐 독립' : '✂️ 구간';
          roleBtn.title = isIndep ? '독립 곡선' : '구간 합성';
          roleBtn.style.cssText = `padding: 2px 5px; font-size: 10px; font-weight: 600; border-radius: 4px; border: 1px solid ${isIndep ? '#00cec9' : '#a29bfe'}; background: ${isIndep ? 'rgba(0, 206, 201, 0.16)' : 'rgba(162, 155, 254, 0.16)'}; color: ${isIndep ? '#00cec9' : '#a29bfe'}; cursor: pointer; line-height: 1.2;`;
          roleBtn.onclick = (e) => {
            e.stopPropagation();
            if (g.isTransposedYX) {
              g.isIndependent = true;
              this.showToast('ℹ️ y=x 대칭 전치 그래프는 항상 독립 곡선으로 동작합니다.');
              return;
            }
            this.pushHistoryState();
            g.isIndependent = !isIndep;
            if (!g.isIndependent) {
              this.showToast(`✂️ f${idx + 1}(x)이 구간 분할에 참여합니다. 상단 칩에서 배정 영역을 지정하세요.`);
            } else {
              this.showToast(`🌐 f${idx + 1}(x)이 독립 관찰 곡선(직선 등)으로 분리되었습니다!`);
            }
            this.renderLayerList();
            this.updateIntersections();
            this.render();
          };
          rightTools.appendChild(roleBtn);
        }

        // [🔗 역함수 대칭 연동 토글 뱃지 버튼]
        if (g.linkedInverseId) {
          const linkBtn = document.createElement('button');
          linkBtn.className = 'btn-layer-tool linked';
          linkBtn.textContent = '🔗';
          linkBtn.title = '연동 해제';
          linkBtn.style.cssText = 'padding: 2px 4px; font-size: 11px; font-weight: 700; background: rgba(162, 155, 254, 0.22); border: 1px solid rgba(162, 155, 254, 0.6); border-radius: 4px; color: #a29bfe; cursor: pointer; line-height: 1.2;';
          linkBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleInverseLink(idx);
          };
          rightTools.appendChild(linkBtn);
        }

        // [🔄 역함수(y=x 대칭) 복제 버튼]
        const invBtn = document.createElement('button');
        invBtn.className = 'btn-layer-tool';
        invBtn.textContent = '🔄';
        invBtn.title = '역함수 복제';
        invBtn.style.cssText = 'padding: 2px 4px; font-size: 11px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #a4b0be; cursor: pointer; line-height: 1.2;';
        invBtn.onclick = (e) => {
          e.stopPropagation();
          this.selectGraph(idx);
          this.cloneInverseGraph();
        };
        rightTools.appendChild(invBtn);

        // [📋 동일 개형 복제 버튼]
        const dupBtn = document.createElement('button');
        dupBtn.className = 'btn-layer-tool';
        dupBtn.textContent = '📋';
        dupBtn.title = '복제';
        dupBtn.style.cssText = 'padding: 2px 4px; font-size: 11px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; color: #a4b0be; cursor: pointer; line-height: 1.2;';
        dupBtn.onclick = (e) => {
          e.stopPropagation();
          this.duplicateGraph(idx);
        };
        rightTools.appendChild(dupBtn);

        // 언제든 삭제 버튼 표시 (마지막 1개도 삭제하여 빈 화면으로 전환 가능)
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-del-layer';
        delBtn.textContent = '✕';
        delBtn.title = 'Delete';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.removeGraph(idx);
        };
        rightTools.appendChild(delBtn);

        item.appendChild(rightTools);

        item.onclick = () => this.selectGraph(idx);
        list.appendChild(item);
      });
    }

    const addBtn = document.getElementById('btnAddGraph');
    if (addBtn) {
      const isMax = this.graphs.length >= 12;
      addBtn.style.opacity = isMax ? '0.35' : '1';
      addBtn.style.cursor = isMax ? 'not-allowed' : 'pointer';
      addBtn.title = isMax ? '최대 12개' : '그래프 추가';
    }
  }

  addGraph(preferredType = null) {
    if (this.isGraphCovered) {
      return this.addGraphToPipCardInBoardMode(preferredType);
    }
    if (this._graphSessionArchived || this.pdfPageBoardData) {
      this.enterGraphModeFromBoard();
    }
    if (this.graphs.length >= 12) {
      this.showToast('⚠️ 그래프는 최대 12개까지 동시에 추가할 수 있습니다.');
      return;
    }

    this.pushHistoryState();

    // 추천 기본 함수 타입 순환 (또는 지정된 개형)
    const presetOrder = ['3rd_normal', '1st_linear', '2nd_quadratic', 'exp_basic', 'geom_quad'];
    const nextType = preferredType || presetOrder[this.graphs.length % presetOrder.length];
    const nextColor = (this.graphColorMode === 'fixed' && this.fixedGraphColor)
      ? this.fixedGraphColor
      : this.colorPalette[this.graphs.length % this.colorPalette.length];

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
      isIndependent: Boolean(this.usePiecewise)
    };

    this.graphs.push(newGraph);
    this.activeGraphIdx = this.graphs.length - 1;
    this.selectedHandleIdx = null;
    this.isCurveSelected = true;
    if (this._currentCat !== '⭐ 내 그래프') {
      this._currentCat = this.normalizePresetTab(newGraph.category);
    }

    // 삼각함수는 6~8주기가 한눈에 보이도록 대파노라마 화각 확장 (단, PDF 개념 페이지 위에서는 아담한 그래프 스케일 ySpan=8.4 유지!)
    if (this.pdfPageBoardData) {
      this.xSpan = 11.5;
      this.ySpan = this.pdfPageBoardData.baseYSpan || 8.4;
      if (this.graphs.length === 1 && typeof this.rebasePdfBoardOriginToScreenCenter === 'function') {
        this.rebasePdfBoardOriginToScreenCenter();
      }
    } else if (["sin_1period", "cos_1period", "tan_1period"].includes(nextType)) {
      this.xSpan = 20.0;
      this.ySpan = 5.5;
    } else {
      this.xSpan = 8.5;
      this.ySpan = 6.0;
    }

    // 🌟 [대표님 기획: 그래프 개형 선택/추가 시 자동으로 좌표평면 On!] 🌟
    // 빈 칠판 모드에서 시작하더라도, 개형을 선택하는 즉시 x·y축과 눈금이 선명하게 활성화됩니다!
    if (!this.showAxes) {
      this.showAxes = true;
      this.updateAxesUI();
    }

    // 🌟 [문제 카드 활성 시 우측 판서 공간 스마트 자동 배치 & 컴팩트 스케일링] 🌟
    // 좌측에 크롭된 문제가 떠 있을 때 첫 그래프를 소환하면:
    // (1) 문제를 가리지 않도록 우측 빈 공간의 정사각형 컴팩트 스테이지 중앙으로 원점 자동 이동
    // (2) 칠판 판서 여백을 위해 적당한 아담한 크기(zoomLevel = 0.68) 및 좌표축 자동 ON
    // (3) 그래프 극점을 바로 잡고 움직일 수 있도록 '조작(select)' 모드로 자동 전환 & 좌측 서랍 자동 접기!
    if (this.hasActiveProblemCard() && !this.pdfPageBoardData) {
      if (this.graphs.length === 1) {
        this.syncProblemCardRectFromWidget();
        if (this.problemCardRect && !this.isProblemCardMinimized) {
          const sw = this.screenWidth || window.innerWidth || 1440;
          const cardRight = this.problemCardRect.x + this.problemCardRect.w;
          const baseRatioOffsetX = Math.round(sw * 0.085);
          const extraCardPushX = Math.max(0, Math.round((cardRight - sw * 0.40) * 0.35));
          const balancedOffsetX = Math.min(Math.round(sw * 0.14), baseRatioOffsetX + extraCardPushX);
          if (this.panX === 0 && this.panY === 0) {
            this.panX = Math.max(0, balancedOffsetX);
            this.panY = 0;
          }
        }
        if (!this.showAxes) {
          this.showAxes = true;
          this.updateAxesUI();
        }
      }
    }

    // 🌟 [대표님 피드백 반영: 그래프 모드 진입 및 그래프 추가 시 무조건 ↖ 이동/조작(select) 모드로 시작!]
    if (this.isInkMode && this.activeInkTool !== 'select') {
      this.setActiveInkTool('select');
    }
    // 🌟 [대표님 기획 반영]: 그래프 추가(panelPresets)·구간 분할(panelPiecewise)·시각화 도구(panelToolkit)·스타일 & 배경(panelStyle)·환경 설정(panelSettings)은 열려 있는 동안 닫히지 않고 유지!
    if (
      typeof this.closeDrawer === 'function' &&
      !this.isDrawerCollapsed &&
      this.activeDrawerPanel !== 'panelPresets' &&
      this.activeDrawerPanel !== 'panelPiecewise' &&
      this.activeDrawerPanel !== 'panelToolkit' &&
      this.activeDrawerPanel !== 'panelStyle' &&
      this.activeDrawerPanel !== 'panelSettings'
    ) {
      this.closeDrawer();
    }

    this.syncControls();
    this.renderLayerList();
    this.renderFuncList();
    this.render();

    this.showToast(`✨ 새 그래프 f${this.graphs.length}(x) (${this.meta[nextType].name}) 추가됨!`);
  }

  removeGraph(idx) {
    if (idx < 0 || idx >= this.graphs.length) return;
    this.pushHistoryState();
    const g = this.graphs[idx];
    const removedGraphId = g ? g.id : null;
    const partner = this.getLinkedPartner(g);
    if (partner) partner.linkedInverseId = null;

    const removedName = this.meta[g.type]?.name || '그래프';
    this.graphs.splice(idx, 1);

    // [📍 종속 보조 수선 클린업]: 대표님 기획 - 원그래프 삭제 시 종속 수선 삭제, 단 교점은 남은 그래프가 이어받기!
    if (this.dropLines && this.dropLines.length > 0) {
      if (this.graphs.length === 0) {
        this.dropLines = [];
      } else if (removedGraphId) {
        this.dropLines = this.dropLines.filter(dl => {
          if (!dl.binding) return true;
          const b = dl.binding;

          // 1. 교점 수선인 경우: 남은 그래프가 이어받기 (Adoption)!
          if (b.isIntersection || b.name === '교점') {
            const ids = b.layerIds || (b.candKey ? b.candKey.split('_').filter(k => k.startsWith('g_') || k.startsWith('graph_')) : []);
            // 남아있는 그래프들 중 교점의 부모가 있는지 확인
            const survivingGraph = this.graphs.find(item => ids.includes(item.id) && item.id !== removedGraphId);
            if (survivingGraph) {
              // 남은 그래프로 부모 바인딩을 이관!
              b.layerId = survivingGraph.id;
              b.layerIds = ids.filter(id => id !== removedGraphId);
              b.isIntersection = false;
              b.type = 'curve'; // 남은 그래프 위의 곡선 점으로 부드럽게 전환하여 추적 유지!
              const worldParam = survivingGraph.isTransposedYX ? dl.sourceY : dl.sourceX;
              b.anchorX = worldParam;
              b.anchorBaseX = this.engine.worldXToBaseX(survivingGraph, worldParam);
              return true; // 교점 수선 살아남음!
            } else {
              // 두 그래프가 모두 삭제되었거나 남은 부모가 없으면 삭제!
              return false;
            }
          }

          // 2. 극점, 꼭짓점, 곡선 위의 점 등 원그래프에 단독 종속된 수선: 원그래프 삭제 시 함께 삭제!
          if (b.layerId === removedGraphId) return false;
          if (b.layerId && !this.graphs.some(item => item.id === b.layerId)) return false;

          return true;
        });
      }
    }

    // [스마트 역함수 대칭선 클린업]: 캔버스에 역함수 연동 쌍이 더 이상 없으면 y = x 가이드라인 자동 OFF
    const hasAnyInverseLink = this.graphs.some(item => item.linkedInverseId);
    if (!hasAnyInverseLink && this.showInverseGuide) {
      this.showInverseGuide = false;
      const chkInv = document.getElementById('chkInverseGuide');
      if (chkInv) chkInv.checked = false;
    }

    if (this.graphs.length === 0) {
      this.activeGraphIdx = -1;
      this.isCurveSelected = false;
      this.selectedPwBoundaryIdx = null;
      this.dropLines = []; // 빈 캔버스 시 수선 100% 완전 정리

      // [모든 함수 삭제 시 y = x 대칭선 잔상 100% 완전 초기화]
      this.showInverseGuide = false;
      const chkInv = document.getElementById('chkInverseGuide');
      if (chkInv) chkInv.checked = false;

      // [대표님 기획]: 모든 함수가 삭제되면 구간 분할 잔상도 100% 완전 초기화!
      this.usePiecewise = false;
      this.isPiecewiseLocked = false;
      this.isPiecewisePeriodic = false;
      this.piecewiseBoundaries = [];
      this.piecewiseFuncMap = [];
      this.piecewiseInclusions = [];
      const chk = document.getElementById('chkPiecewise');
      if (chk) chk.checked = false;
      const btnQuick = document.getElementById('btnQuickPiecewise');
      if (btnQuick) btnQuick.classList.remove('active');
      const pwControls = document.getElementById('pwControls');
      if (pwControls) pwControls.style.display = 'none';
      const pwPopover = document.getElementById('pwRegionPopover');
      if (pwPopover) pwPopover.style.display = 'none';
      this._openPwRegionIdx = null;
      this.syncPeriodicUI();

      this.showToast(`🗑️ ${removedName} 삭제됨`);
    } else {
      if (this.activeGraphIdx >= this.graphs.length) {
        this.activeGraphIdx = this.graphs.length - 1;
      }
      // 삭제된 함수 인덱스를 piecewiseFuncMap에서 안전하게 '함수 없음(-1)'으로 대체 및 인덱스 정렬
      if (this.piecewiseFuncMap && this.piecewiseFuncMap.length > 0) {
        this.piecewiseFuncMap = this.piecewiseFuncMap.map(fi => {
          if (fi === -1) return -1;
          if (fi === idx) return -1; // 삭제된 함수는 비움으로 안전 전환
          if (fi > idx) return fi - 1; // 삭제된 인덱스 이후의 함수 번호 당김
          return fi;
        });
        this.updatePwDescBadge();
      }
      this.showToast(`🗑️ ${removedName} 삭제 완료!`);
    }
    this.selectedHandleIdx = null;
    this.isCurveSelected = false;

    this.syncControls();
    this.syncCurveContextBar();
    this.renderLayerList();
    this.renderFuncList();
    this.updateIntersections();
    this.syncGraphSnapBarUI();
    this.render();
  }

  // --- [🗑️ 1. 그래프만 지우기 (필기 & 떠 있는 문제 카드는 그대로 보존)] ---
  clearAllGraphs() {
    if (this.isGraphCovered) {
      const hasPipCards = Boolean(this._hasPrimaryGraphCard || (this.extraGraphCards && this.extraGraphCards.length > 0));
      if (!hasPipCards) {
        this.showToast('ℹ️ 현재 칠판에 떠 있는 그래프 카드가 없습니다.');
        return;
      }
      const btnClosePrimary = document.getElementById('btnGraphCardClose');
      if (this._hasPrimaryGraphCard && btnClosePrimary) {
        btnClosePrimary.click();
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => { if (c && c.el) c.el.remove(); });
        this.extraGraphCards = [];
      }
      document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
      if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets') {
        this._pipTargetCard = 'new';
        this._pipSessionOrigin = 'rail';
        const btnPresets = document.getElementById('btnRailPresets');
        if (btnPresets) btnPresets.classList.add('active');
      } else {
        this._pipTargetCard = null;
        this._pipSessionOrigin = null;
      }
      this.syncPresetActiveButtons();
      this.syncShapePanel();
      this.render();
      this.showToast('🗑️ 칠판 위의 모든 그래프 카드를 비웠습니다.');
      return;
    }

    const hasGraphElements = (
      this.graphs.length > 0 ||
      this.usePiecewise ||
      (this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) ||
      (this.dropLines && this.dropLines.length > 0) ||
      (this.textLabels && this.textLabels.length > 0)
    );
    if (!hasGraphElements) {
      this.showToast('ℹ️ 지울 그래프나 경계선이 없습니다.');
      return;
    }

    this.pushHistoryState();
    this.graphs = [];
    this.activeGraphIdx = -1;
    this.selectedHandleIdx = null;
    this.isCurveSelected = false;
    this.selectedPwBoundaryIdx = null;
    this.dropLines = [];
    this.textLabels = [];

    // y = x 대칭 기준선 해제
    this.showInverseGuide = false;
    const chkInv = document.getElementById('chkInverseGuide');
    if (chkInv) chkInv.checked = false;

    // 구간 분할 & 주기 반복 잔상 완전 초기화
    this.usePiecewise = false;
    this.piecewiseBoundaries = [];
    this.piecewiseFuncMap = [];
    this.piecewiseInclusions = [];
    this.isPiecewisePeriodic = false;
    this.periodicStepY = 0;
    this.isPiecewiseLocked = false;
    this.syncPeriodicUI();
    const chk = document.getElementById('chkPiecewise');
    if (chk) chk.checked = false;
    const btnQuick = document.getElementById('btnQuickPiecewise');
    if (btnQuick) btnQuick.classList.remove('active');
    const pwControls = document.getElementById('pwControls');
    if (pwControls) pwControls.style.display = 'none';

    this.syncControls();
    this.renderLayerList();
    this.renderFuncList();
    this.updateIntersections();
    this.syncGraphSnapBarUI();
    this.render();

    this.showToast('✨ 그래프와 경계선만 지웠습니다!');
  }

  // --- [🧹 3. 새 캔버스 (전체 초기화: 그래프 + 경계선 + 필기 + 떠 있는 문제/보관 카드 전부 초기화)] ---
  resetNewCanvas() {
    const pWidget = document.getElementById('problemCardWidget');
    const hasPrimaryProblem = Boolean(pWidget && this.problemCardData && !this._retainedPdfAudioProbCard);
    const hasExtraProblems = Boolean(this.extraProblemCards && this.extraProblemCards.length > 0);
    const hasGraphCards = Boolean(
      (this._hasPrimaryGraphCard && this.graphCardData) ||
      (this.extraGraphCards && this.extraGraphCards.length > 0) ||
      this.isGraphCovered
    );
    const hasAnything = (
      this.graphs.length > 0 ||
      (this.inkStrokes && this.inkStrokes.length > 0) ||
      this.usePiecewise ||
      (this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) ||
      (this.dropLines && this.dropLines.length > 0) ||
      (this.textLabels && this.textLabels.length > 0) ||
      hasPrimaryProblem ||
      hasExtraProblems ||
      hasGraphCards ||
      Boolean(this.pdfPageBoardData) ||
      Boolean(this.isLessonPlaylistActive && this.lessonPlaylistSlides && this.lessonPlaylistSlides.length > 0) ||
      this.panX !== 0 ||
      this.panY !== 0 ||
      this.boardPanX !== 0 ||
      this.boardPanY !== 0 ||
      Math.abs((this.zoomLevel || 1) - 1.0) > 0.001 ||
      !this.isGraphCovered ||
      !this.showAxes
    );

    if (!hasAnything) {
      this.showToast('ℹ️ 이미 깨끗한 새 캔버스 상태입니다.');
      return;
    }

    // 🌟 실행 취소(Ctrl+Z) 시 떠 있던 문제 카드까지 100% 복구되도록 전체 워크스페이스 스냅샷 저장!
    if (!this.isHistoryProcessing) {
      const fullSnap = this._captureFullWorkspaceSnapshot();
      this.undoStack.push({ type: 'workspace_snapshot', snapshot: fullSnap });
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.updateUndoRedoUI();
    }

    // 1. 떠 있는 모든 문제 카드(기본 + 추가) 제거
    this.closeProblemCard();
    if (this.extraProblemCards && this.extraProblemCards.length > 0) {
      this.extraProblemCards.forEach(c => {
        if (c && c.el) c.el.remove();
      });
      this.extraProblemCards = [];
    }

    // 2. 보관된 모든 그래프 카드(#1, #2...) 및 2층 칠판 덮개 해제
    this._hasPrimaryGraphCard = false;
    this.graphCardData = null;
    this.graphCardRect = null;
    this.graphInkStrokes = [];
    const gWidget = document.getElementById('graphCardWidget');
    if (gWidget) gWidget.style.display = 'none';
    if (this.extraGraphCards && this.extraGraphCards.length > 0) {
      this.extraGraphCards.forEach(c => {
        if (c && c.el) c.el.remove();
      });
      this.extraGraphCards = [];
    }
    this._graphCaseCounter = 0;
    this.isGraphCovered = true;
    this._graphSessionArchived = false;
    this._suspendedPdfBoardState = null;
    this._isTempPdfProblemCard = false;
    this._coveredGraphStateBackup = null;
    this._savedLayer2BoardPan = null;
    this._suspendedPdfBoardState = null;
    this._isTempPdfProblemCard = false;
    this._graphSessionArchived = false;
    this.isPdfToGraphCropMode = false;
    this.isPdfToGraphCropDragging = false;

    // 3. 모든 그래프 및 구간 분할 / 주기 반복 초기화
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
    this.syncPeriodicUI();
    const chkPw = document.getElementById('chkPiecewise');
    if (chkPw) chkPw.checked = false;
    const btnQuickPw = document.getElementById('btnQuickPiecewise');
    if (btnQuickPw) btnQuickPw.classList.remove('active');
    const pwControls = document.getElementById('pwControls');
    if (pwControls) pwControls.style.display = 'none';
    const pwPopover = document.getElementById('pwRegionPopover');
    if (pwPopover) pwPopover.style.display = 'none';

    // 4. 수선, 텍스트 라벨 및 모든 칠판 필기 초기화
    this.dropLines = [];
    this.textLabels = [];
    this.inkStrokes = [];
    this.boardStickers = [];
    this.problemCardStickers = [];
    this.graphCardStickers = [];
    const pWReset = document.getElementById('problemCardWidget');
    if (pWReset && typeof pWReset._renderCardStickers === 'function') pWReset._renderCardStickers();
    const gWReset = document.getElementById('graphCardWidget');
    if (gWReset && typeof gWReset._renderCardStickers === 'function') gWReset._renderCardStickers();
    this.selectedInkIndices = [];
    this.inkLassoBox = null;
    this._inkBakeDirty = true;
    this.clearInkCache();

    // 5. 초기 시작 뷰 및 좌표축(축/그리드/줌/팬) 및 PDF 개념 보드 & 슬라이드 묶음 초기화
    this.pdfPageBoardData = null;
    this.pdfSavedPageStates = {};
    this.pdfWorkedPages = [];
    this._lastPdfPageScreenRect = null;
    this.isLessonPlaylistActive = false;
    this.lessonPlaylistSlides = [];
    this.lessonPlaylistIndex = 0;
    this.isTopSlideBarHidden = false;
    this.lessonTeachingMode = null;
    this._activeLoadedCloudLibraryMeta = null;
    this._lastShareModalDeckTitle = '';
    const inpDeckReset = document.getElementById('inputShareModalDeckTitle');
    if (inpDeckReset) inpDeckReset.value = '';
    const inpCloudReset = document.getElementById('inputCloudSaveTitle');
    if (inpCloudReset) inpCloudReset.value = '';
    this.syncCloudHubRailLockUI();
    this.syncPdfModalModeUI();
    this.syncPdfBoardNavBarUI();
    this.syncLessonPlaylistNavBarUI();
    this.showAxes = true;
    this.showInverseGuide = false;
    const chkInv = document.getElementById('chkInverseGuide');
    if (chkInv) chkInv.checked = false;
    const chkGuides = document.getElementById('chkGuides');
    if (chkGuides) chkGuides.checked = Boolean(this.showGuides);
    this.panX = 0;
    this.panY = 0;
    this.boardPanX = 0;
    this.boardPanY = 0;
    this.boardZoom = 1.0;
    this.boardZoomOffsetX = 0;
    this.boardZoomOffsetY = 0;
    this.setZoomLevel(1.0);
    this.updateAxesUI();

    if (!this.isInkMode) {
      this.toggleInkMode(true);
    }
    this.setActiveInkTool('pen');
    this.syncControls();
    this.renderLayerList();
    this.renderFuncList();
    this.updateIntersections();
    this.syncWorkspaceModeUI();
    this.syncGraphSnapBarUI();
    this.render();

    this.showToast('✨ 새 캔버스(필기 모드)로 전체 초기화했습니다!');
  }

  selectGraph(idx) {
    if (idx < 0 || idx >= this.graphs.length) return;
    this.activeGraphIdx = idx;
    this.selectedHandleIdx = null;
    this.isCurveSelected = true;
    this._currentCat = this.normalizePresetTab(this._currentCat);

    this.syncControls();
    this.renderLayerList();
    this.renderFuncList();
    this.render();
  }

  // ➕ 무한 다단 절댓값 다시 접기 (Infinite Multi-Stage Absolute Value)
  foldAgain() {
    if (!this.activeGraph || !this.activeGraph.isAbsolute) return;
    this.pushHistoryState();
    const g = this.activeGraph;
    if (!g.transforms) g.transforms = [];
    const curOx = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
    const curOy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
    g.transforms.push({ offset: { x: curOx, y: curOy }, abs: true });
    g.freezeOffset = { x: 0, y: 0 };
    const partner = this.getLinkedPartner(g);
    if (partner && typeof this._syncLinkedPartnerToTransposedMirror === 'function') {
      this._syncLinkedPartnerToTransposedMirror(g, partner);
      this.renderLayerList();
    }
    this.syncControls();
    this.updateIntersections();
    this.render();
    const stage = g.transforms.length + 1;
    this.showToast(`✨ ${stage}차 절댓값 재접기 완료!`);
  }

  _syncLineWidthSliderUI() {
    const isGraphSelected = Boolean(this.activeGraph && (this.isCurveSelected || this.selectedHandleIdx !== null));
    const targetLw = isGraphSelected
      ? (this.activeGraph.lineWidth || this.defaultGraphLineWidth || 2.8)
      : (this.defaultGraphLineWidth || 2.8);
    if (this._lastSyncedLwVal === targetLw) return;
    this._lastSyncedLwVal = targetLw;
    const sliderLw = this._sliderLwEl || (this._sliderLwEl = document.getElementById('sliderLw'));
    const lblLw = this._lblLwEl || (this._lblLwEl = document.getElementById('lblLw'));
    if (sliderLw) sliderLw.value = targetLw;
    if (lblLw) lblLw.textContent = `${Number(targetLw).toFixed(1)}`;
  }

  syncGraphColorPaletteUI() {
    const mode = (this.graphColorMode === 'fixed') ? 'fixed' : 'auto';
    document.querySelectorAll('.graph-color-mode-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.colorMode === mode);
    });

    const seq = (Array.isArray(this.autoColorSequence) && this.autoColorSequence.length > 0)
      ? this.autoColorSequence
      : (this.defaultAutoColorSequence || ['#c74440', '#2d70b3', '#388c46', '#6042a6']);
    this.colorPalette = [...seq];

    const fixedColor = (this.fixedGraphColor || '#1e293b').toLowerCase();
    document.querySelectorAll('#graphColorPalette .color-dot').forEach(dot => {
      const dotColor = (dot.dataset.color || '').toLowerCase();
      if (mode === 'fixed') {
        dot.textContent = '';
        dot.classList.toggle('active', dotColor === fixedColor);
      } else {
        const seqIdx = seq.findIndex(c => (c || '').toLowerCase() === dotColor);
        if (seqIdx !== -1) {
          dot.classList.add('active');
          dot.textContent = String(seqIdx + 1);
        } else {
          dot.classList.remove('active');
          dot.textContent = '';
        }
      }
    });
  }

  _applyCurrentColorRuleToActiveTarget() {
    const isFixed = (this.graphColorMode === 'fixed');
    const fixedColor = this.fixedGraphColor || '#1e293b';
    const seq = (Array.isArray(this.colorPalette) && this.colorPalette.length > 0)
      ? this.colorPalette
      : ['#c74440', '#2d70b3', '#388c46', '#6042a6'];

    if (!this.isGraphCovered) {
      if (Array.isArray(this.graphs) && this.graphs.length > 0) {
        this.pushHistoryState();
        this.graphs.forEach((g, idx) => {
          if (g) g.color = isFixed ? fixedColor : seq[idx % seq.length];
        });
        this.syncCurveContextBar();
        this.renderLayerList();
        this.render();
      }
      return;
    }

    let resolvedCard = null;
    const explicitCard = (this._pipTargetCard && this._pipTargetCard !== 'new') ? this._pipTargetCard : null;
    const isValidExplicit = Boolean(
      (explicitCard === 'primary' && this._hasPrimaryGraphCard && this.graphCardData) ||
      (explicitCard && explicitCard !== 'primary' && Array.isArray(this.extraGraphCards) && this.extraGraphCards.includes(explicitCard))
    );
    if (isValidExplicit) {
      resolvedCard = explicitCard;
    } else if (typeof this._getTargetPipGraphCardForAxisOrPreset === 'function') {
      const targetObj = this._getTargetPipGraphCardForAxisOrPreset();
      if (targetObj && targetObj.cardRef) {
        resolvedCard = targetObj.cardRef;
      }
    }
    if (resolvedCard && typeof this._getMutablePipCardSnapshot === 'function') {
      const snap = this._getMutablePipCardSnapshot(resolvedCard);
      if (snap && !snap.isNAxisStudioCard && Array.isArray(snap.graphs) && snap.graphs.length > 0) {
        if (typeof this._pushWorkspaceUndoSnapshot === 'function') {
          this._pushWorkspaceUndoSnapshot('↺ 그래프 색상이 이전 상태로 복원되었습니다', '↻ 그래프 색상 변경 다시 실행됨');
        }
        snap.graphs.forEach((g, idx) => {
          if (g) g.color = isFixed ? fixedColor : seq[idx % seq.length];
        });
        if (typeof this._savePipCardSnapshot === 'function') this._savePipCardSnapshot(resolvedCard, snap);
        if (typeof this.syncPipCardLockUI === 'function') this.syncPipCardLockUI(resolvedCard);
        if (typeof this.renderPipGraphCard === 'function') this.renderPipGraphCard(resolvedCard);
        if (typeof this.scheduleBakePipGraphCardToImg === 'function') this.scheduleBakePipGraphCardToImg(resolvedCard);
        if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
      }
    }
  }

  syncControls() {
    const g = this.activeGraph;

    // 카테고리 탭 동기화 (3탭: tab_basic | tab_calculus | ⭐ 내 그래프)
    const curCat = this.normalizePresetTab(this._currentCat);
    document.querySelectorAll('#panelPresets .cat-tab-btn').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.cat === curCat);
    });
    this.syncPresetActiveButtons();

    this.syncGraphColorPaletteUI();
    this._syncLineWidthSliderUI();

    if (!g) {
      // 그래프가 없는 빈 상태일 때의 UI 처리
      const chkAbs = document.getElementById('chkAbs');
      if (chkAbs) chkAbs.checked = false;
      const btnFoldAgain = document.getElementById('btnFoldAgain');
      if (btnFoldAgain) btnFoldAgain.style.display = 'none';
      this.syncShapePanel();
      this.syncCurveContextBar();
      return;
    }

    // 절댓값 체크박스 동기화
    const chkAbs = document.getElementById('chkAbs');
    if (chkAbs) chkAbs.checked = g.isAbsolute;

    // ➕ 무한 다단 절댓값 다시 접기 버튼 동기화
    const btnFoldAgain = document.getElementById('btnFoldAgain');
    if (btnFoldAgain) {
      const curOx = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      const curOy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
      const hasOffset = Math.abs(curOx) > 0.05 || Math.abs(curOy) > 0.05;
      const hasTransforms = g.transforms && g.transforms.length > 0;
      if (g.isAbsolute && (hasOffset || hasTransforms)) {
        btnFoldAgain.style.display = 'inline-block';
        btnFoldAgain.textContent = hasTransforms ? `➕ ${g.transforms.length + 1}차 다시 접기` : '➕ 다시 접기';
      } else {
        btnFoldAgain.style.display = 'none';
      }
    }

    // 사각형 모드 패널 동기화 (사각형 활성 시에만 표시)
    this.syncShapePanel();

    // 🔗 역함수 대칭 연동 상태 버튼 동기화 (대표님 기획: '✂️ 연동끊기'로 직관화)
    const btnToggleLink = document.getElementById('btnToggleInverseLink');
    if (btnToggleLink) {
      if (g && g.linkedInverseId) {
        btnToggleLink.style.display = 'block';
        btnToggleLink.innerHTML = '✂️ 연동끊기';
        btnToggleLink.title = '클릭 시 두 함수의 연동을 끊어 각자 독립적으로 조작합니다.';
      } else {
        btnToggleLink.style.display = 'none';
      }
    }

    // 📈 |f(x)| 절댓값 버튼 활성 상태 동기화 (대표님 규칙: 그래프 움직임 시 active 해제)
    const btnToggleAbs = document.getElementById('btnToggleAbs');
    if (btnToggleAbs) {
      const isAbsActive = g ? Boolean(g.isAbsolute && g.isAbsPristine) : false;
      btnToggleAbs.classList.toggle('active', isAbsActive);
      btnToggleAbs.style.background = isAbsActive ? 'rgba(0, 210, 211, 0.22)' : '';
      btnToggleAbs.style.borderColor = isAbsActive ? 'var(--accent-cyan)' : '';
      btnToggleAbs.style.color = isAbsActive ? 'var(--accent-cyan)' : '';
    }

    // 🌟 [대표님 기획: ⚙️ 설정 패널 체크박스 및 바깥 캡처영역 버튼 동기화]
    const btnRailVf = document.getElementById('btnRailToggleVf');
    if (btnRailVf) btnRailVf.classList.toggle('active', Boolean(this.useViewfinder));
    const chkStylus = document.getElementById('chkShowVirtualStylus');
    if (chkStylus) chkStylus.checked = Boolean(this.showVirtualStylus);
    const chkSnap = document.getElementById('chkMagneticSnap');
    if (chkSnap) chkSnap.checked = Boolean(this.useMagneticSnap);
    const chkGuides = document.getElementById('chkGuides');
    if (chkGuides) chkGuides.checked = Boolean(this.showGuides);
    const chkGridNumbers = document.getElementById('chkGridNumbers');
    if (chkGridNumbers) chkGridNumbers.checked = Boolean(this.showGridNumbers);
    const chkAsym = document.getElementById('chkAsymptotes');
    if (chkAsym) chkAsym.checked = Boolean(this.showAsymptotes);
    const chkInv = document.getElementById('chkInverseGuide');
    if (chkInv) chkInv.checked = Boolean(this.showInverseGuide);
    if (typeof this.syncAxisVisibilityUI === 'function') {
      this.syncAxisVisibilityUI();
    }

    // 🌟 [대표님 기획: 상단 중앙 초슬림 캡슐바 동기화]
    this.syncCurveContextBar();
  }

  normalizePresetTab(cat) {
    if (cat === '⭐ 내 그래프' || cat === 'tab_custom') return '⭐ 내 그래프';
    if (cat === 'tab_calculus' || cat === '🔥 수능 킬러') return 'tab_calculus';
    return 'tab_basic';
  }

  _resolvePresetTargetContext() {
    if (!this.isGraphCovered) {
      return {
        g: this.activeGraph || null,
        isBoardPip: false,
        cardRef: null,
        snap: null,
        widget: null
      };
    }
    if (this._pipTargetCard === 'new') {
      return { g: null, isBoardPip: true, cardRef: null, snap: null, widget: null };
    }
    let resolvedCard = null;
    const explicitCard = (this._pipTargetCard && this._pipTargetCard !== 'new') ? this._pipTargetCard : null;
    const isValidExplicit = Boolean(
      (explicitCard === 'primary' && this._hasPrimaryGraphCard && this.graphCardData) ||
      (explicitCard && explicitCard !== 'primary' && Array.isArray(this.extraGraphCards) && this.extraGraphCards.includes(explicitCard))
    );
    if (isValidExplicit) {
      resolvedCard = explicitCard;
    } else if (typeof this._getTargetPipGraphCardForAxisOrPreset === 'function') {
      const targetObj = this._getTargetPipGraphCardForAxisOrPreset();
      if (targetObj && targetObj.cardRef) {
        resolvedCard = targetObj.cardRef;
      }
    }
    if (!resolvedCard || typeof this._getMutablePipCardSnapshot !== 'function') {
      return { g: null, isBoardPip: true, cardRef: null, snap: null, widget: null };
    }
    const snap = this._getMutablePipCardSnapshot(resolvedCard);
    if (!snap || snap.isNAxisStudioCard || !Array.isArray(snap.graphs) || snap.graphs.length === 0) {
      return { g: null, isBoardPip: true, cardRef: resolvedCard, snap: null, widget: null };
    }
    const idx = (typeof snap.activeGraphIdx === 'number' && snap.activeGraphIdx >= 0 && snap.activeGraphIdx < snap.graphs.length)
      ? snap.activeGraphIdx
      : (snap.graphs.length - 1);
    const widgetInfo = (typeof this._getPipCardWidgetAndSnapRaw === 'function')
      ? this._getPipCardWidgetAndSnapRaw(resolvedCard)
      : null;
    return {
      g: snap.graphs[idx] || null,
      isBoardPip: true,
      cardRef: resolvedCard,
      snap,
      widget: widgetInfo ? widgetInfo.widget : null
    };
  }

  syncPresetActiveButtons() {
    const activeTab = this.normalizePresetTab(this._currentCat);
    document.querySelectorAll('#panelPresets .cat-tab-btn').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.cat === activeTab);
    });

    const myTabBtn = document.getElementById('btnCatTabMyGraphs');
    if (myTabBtn) {
      const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
      const count = (isLoggedIn && Array.isArray(this.customGraphPresets)) ? this.customGraphPresets.length : 0;
      const nextHtml = count > 0
        ? `<span>내 그래프</span><span class="preset-tab-count-pill">${count}</span>`
        : `<span>내 그래프</span>`;
      if (myTabBtn._lastRenderedHtml !== nextHtml) {
        myTabBtn._lastRenderedHtml = nextHtml;
        myTabBtn.innerHTML = nextHtml;
      }
    }

    const grid = document.getElementById('funcGrid');
    if (!grid) return;
    const ctx = this._resolvePresetTargetContext();
    const activeType = (ctx && ctx.g && ctx.g.type) ? ctx.g.type : '';
    grid.querySelectorAll('.func-btn[data-preset]').forEach(btn => {
      btn.classList.toggle('active', Boolean(activeType && btn.dataset.preset === activeType));
    });
  }

  _buildSquarePresetThumbnailSvg(key) {
    if (!this._squarePresetThumbCache) this._squarePresetThumbCache = {};
    if (this._squarePresetThumbCache[key]) return this._squarePresetThumbCache[key];

    const E = this.engine || window.GraphMathEngine;
    if (!E || typeof E.evaluate !== 'function') {
      return (this.meta && this.meta[key] && this.meta[key].svg) || '';
    }

    const W = 64, H = 64;
    const sampleCurve = (handles, xMin, xMax, yMin, yMax, pad = 8.5, steps = 84) => {
      const innerW = W - pad * 2;
      const innerH = H - pad * 2;
      const toX = (x) => pad + ((x - xMin) / (xMax - xMin)) * innerW;
      const toY = (y) => H - pad - ((y - yMin) / (yMax - yMin)) * innerH;
      const segments = [];
      let cur = [];
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (xMax - xMin) * (i / steps);
        const y = E.evaluate(key, handles, x);
        if (typeof y !== 'number' || isNaN(y) || !isFinite(y)) {
          if (cur.length >= 2) segments.push(cur);
          cur = [];
          continue;
        }
        const sx = toX(x);
        const sy = toY(y);
        if (sy < pad - 2 || sy > H - pad + 2) {
          if (cur.length > 0) {
            const prev = cur[cur.length - 1];
            const clipY = sy < pad - 2 ? pad - 1.5 : H - pad + 1.5;
            if (Math.abs(sy - prev.sy) > 1e-6) {
              const t = (clipY - prev.sy) / (sy - prev.sy);
              if (t >= 0 && t <= 1) {
                cur.push({ sx: prev.sx + t * (sx - prev.sx), sy: clipY });
              }
            }
            if (cur.length >= 2) segments.push(cur);
            cur = [];
          }
          continue;
        }
        cur.push({ sx, sy });
      }
      if (cur.length >= 2) segments.push(cur);

      const d = segments.map(seg => {
        const kept = [seg[0]];
        for (let i = 1; i < seg.length - 1; i++) {
          const prev = kept[kept.length - 1];
          const p = seg[i];
          if (Math.hypot(p.sx - prev.sx, p.sy - prev.sy) >= 1.3) {
            kept.push(p);
          }
        }
        kept.push(seg[seg.length - 1]);
        return kept.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');
      }).join(' ');

      return {
        d,
        toX: (x) => Number(toX(x).toFixed(1)),
        toY: (y) => Number(toY(y).toFixed(1))
      };
    };

    let axesSvg = '';
    let guidesSvg = '';
    let dotsSvg = '';
    let pathD = '';

    const solidDot = (cx, cy) => `<circle class="sq-dot-solid" cx="${cx}" cy="${cy}" r="2.35"/>`;
    const hollowDot = (cx, cy) => `<circle class="sq-dot-hollow" cx="${cx}" cy="${cy}" r="2.35"/>`;
    const dashedLine = (x1, y1, x2, y2) => `<line class="sq-guide" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const axisCross = (x0, y0, pad = 6) => (
      `<line class="sq-axis" x1="${pad}" y1="${y0}" x2="${W - pad}" y2="${y0}"/>` +
      `<line class="sq-axis" x1="${x0}" y1="${pad}" x2="${x0}" y2="${H - pad}"/>`
    );

    switch (key) {
      case '3rd_monotonic': {
        const handles = [{ x: 0, y: 0 }, { x: 1.35, y: 2.35 }];
        const s = sampleCurve(handles, -1.48, 1.48, -2.55, 2.55, 8.5, 84);
        const m = 0.35 * (2.35 / 1.35);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(-1.28), s.toY(-1.28 * m), s.toX(1.28), s.toY(1.28 * m));
        dotsSvg = hollowDot(s.toX(0), s.toY(0));
        break;
      }
      case '3rd_basic_cubic': {
        const handles = [{ x: 0, y: 0 }, { x: 1.2, y: 1.728 }];
        const s = sampleCurve(handles, -1.36, 1.36, -2.45, 2.45, 8.5, 84);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(-1.16), s.toY(0), s.toX(1.16), s.toY(0));
        dotsSvg = hollowDot(s.toX(0), s.toY(0));
        break;
      }
      case '3rd_normal': {
        const handles = [{ x: -1, y: 2.05 }, { x: 1, y: -2.05 }, { x: 0, y: 0 }];
        const s = sampleCurve(handles, -2.12, 2.12, -2.85, 2.85, 8.5, 88);
        pathD = s.d;
        dotsSvg = solidDot(s.toX(-1), s.toY(2.05)) + solidDot(s.toX(1), s.toY(-2.05));
        break;
      }
      case '4th_basic_bowl': {
        const handles = [{ x: 0, y: -2.0 }, { x: 1.35, y: 1.85 }];
        const s = sampleCurve(handles, -1.5, 1.5, -2.4, 2.75, 8.5, 84);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(-1.12), s.toY(-2.0), s.toX(1.12), s.toY(-2.0));
        dotsSvg = solidDot(s.toX(0), s.toY(-2.0));
        break;
      }
      case '4th_skew': {
        const handles = [{ x: 0.9, y: -2.0 }, { x: -0.95, y: 0.65 }];
        const p = E._solve4thSkewParams(handles);
        const s = sampleCurve(handles, -1.85, 2.02, -2.45, 2.8, 8.5, 84);
        const xs = -0.95;
        const ys = E.evaluate('4th_skew', handles, xs);
        const slope = 4 * p.a * (xs - p.x0) * (p.T * p.d * p.d);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(xs - 0.68), s.toY(ys - 0.68 * slope), s.toX(xs + 0.68), s.toY(ys + 0.68 * slope));
        dotsSvg = hollowDot(s.toX(xs), s.toY(ys)) + solidDot(s.toX(0.9), s.toY(-2.0));
        break;
      }
      case '4th_inflection': {
        const handles = [{ x: -0.85, y: 0.65 }, { x: 0.95, y: -2.0 }];
        const s = sampleCurve(handles, -1.72, 1.7, -2.45, 2.8, 8.5, 84);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(-1.5), s.toY(0.65), s.toX(-0.15), s.toY(0.65));
        dotsSvg = hollowDot(s.toX(-0.85), s.toY(0.65)) + solidDot(s.toX(0.95), s.toY(-2.0));
        break;
      }
      case '4th_symmetric': {
        const handles = [{ x: -1.35, y: -2.0 }, { x: 0.0, y: 0.95 }, { x: 1.35, y: -2.0 }];
        const s = sampleCurve(handles, -2.18, 2.18, -2.45, 2.75, 8.5, 92);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(-1.88), s.toY(-2.0), s.toX(1.88), s.toY(-2.0));
        dotsSvg = solidDot(s.toX(-1.35), s.toY(-2.0)) + solidDot(s.toX(0), s.toY(0.95)) + solidDot(s.toX(1.35), s.toY(-2.0));
        break;
      }
      case '4th_asymmetric': {
        const handles = [{ x: -1.25, y: -0.15 }, { x: -0.25, y: 1.15 }, { x: 1.25, y: -2.5 }];
        const yL = E.evaluate('4th_asymmetric', handles, -1.25);
        const yM = E.evaluate('4th_asymmetric', handles, -0.25);
        const yR = E.evaluate('4th_asymmetric', handles, 1.25);
        const s = sampleCurve(handles, -2.0, 2.18, -2.85, 2.55, 8.5, 92);
        pathD = s.d;
        guidesSvg = dashedLine(s.toX(-1.72), s.toY(yL), s.toX(-0.75), s.toY(yL)) +
          dashedLine(s.toX(0.75), s.toY(yR), s.toX(1.72), s.toY(yR));
        dotsSvg = solidDot(s.toX(-1.25), s.toY(yL)) + solidDot(s.toX(-0.25), s.toY(yM)) + solidDot(s.toX(1.25), s.toY(yR));
        break;
      }
      case 'killer_exp_linear': {
        const handles = [{ x: 0, y: 0 }, { x: 0.9, y: 2.1 }];
        const s = sampleCurve(handles, -0.65, 3.8, -1.7, 2.6, 7.5, 96);
        pathD = s.d;
        axesSvg = axisCross(s.toX(0), s.toY(0), 5.5);
        guidesSvg = dashedLine(s.toX(0.9), s.toY(2.1), s.toX(0.9), s.toY(0));
        dotsSvg = hollowDot(s.toX(0), s.toY(0)) + solidDot(s.toX(0.9), s.toY(2.1));
        break;
      }
      case 'killer_exp_quad': {
        const handles = [{ x: 0, y: 0 }, { x: 1.5, y: 1.55 }];
        const s = sampleCurve(handles, -0.82, 4.18, -0.65, 2.65, 7.5, 110);
        pathD = s.d;
        axesSvg = axisCross(s.toX(0), s.toY(0), 5.5);
        guidesSvg = dashedLine(s.toX(1.5), s.toY(1.55), s.toX(1.5), s.toY(0));
        dotsSvg = solidDot(s.toX(0), s.toY(0)) + solidDot(s.toX(1.5), s.toY(1.55));
        break;
      }
      case 'killer_log_frac': {
        const handles = [{ x: 0, y: 0 }, { x: 1.75, y: 1.85 }];
        const xInt = 1.75 / Math.E;
        const s = sampleCurve(handles, -0.55, 7.4, -2.1, 2.4, 7.5, 130);
        pathD = s.d;
        axesSvg = axisCross(s.toX(0), s.toY(0), 5.5);
        guidesSvg = dashedLine(s.toX(1.75), s.toY(1.85), s.toX(1.75), s.toY(0));
        dotsSvg = hollowDot(s.toX(xInt), s.toY(0)) + solidDot(s.toX(1.75), s.toY(1.85));
        break;
      }
      case 'killer_frac_odd': {
        const handles = [{ x: 0, y: 0 }, { x: 1.0, y: 2.05 }];
        const s = sampleCurve(handles, -3.8, 3.8, -2.65, 2.65, 7.5, 96);
        pathD = s.d;
        axesSvg = axisCross(s.toX(0), s.toY(0), 5.5);
        guidesSvg = dashedLine(s.toX(1.0), s.toY(2.05), s.toX(1.0), s.toY(0)) +
          dashedLine(s.toX(-1.0), s.toY(-2.05), s.toX(-1.0), s.toY(0));
        dotsSvg = hollowDot(s.toX(0), s.toY(0)) + solidDot(s.toX(-1.0), s.toY(-2.05)) + solidDot(s.toX(1.0), s.toY(2.05));
        break;
      }
      default:
        return (this.meta && this.meta[key] && this.meta[key].svg) || '';
    }

    const svg = `<svg viewBox="0 0 64 64" class="preset-sq-svg" fill="none" aria-hidden="true">${axesSvg}${guidesSvg}<path class="sq-curve" d="${pathD}"/>${dotsSvg}</svg>`;
    this._squarePresetThumbCache[key] = svg;
    return svg;
  }

  renderFuncList(forceRebuild = false) {
    const grid = document.getElementById('funcGrid');
    if (!grid) return;

    const activeTab = this.normalizePresetTab(this._currentCat);
    this.syncPresetActiveButtons();

    if (activeTab === '⭐ 내 그래프') {
      grid.innerHTML = '';
      grid.dataset.renderedTab = '⭐ 내 그래프';
      grid.classList.add('is-my-graphs-tab');
      const presetSec = document.createElement('div');
      presetSec.className = 'func-preset-section is-full-tab';
      this.renderCustomGraphPresetList(presetSec);
      grid.appendChild(presetSec);
      this.syncShapePanel();
      return;
    }

    grid.classList.remove('is-my-graphs-tab');
    if (!forceRebuild && grid.dataset.renderedTab === activeTab && grid.children.length > 0) {
      this.syncPresetActiveButtons();
      this.syncShapePanel();
      return;
    }

    grid.innerHTML = '';
    grid.dataset.renderedTab = activeTab;

    const bindPresetClick = (btn, key) => {
      btn.onclick = () => {
        if (!this.isGraphCovered && this.graphs.length >= 12) {
          this.showToast('⚠️ 그래프는 최대 12개까지 동시에 추가할 수 있습니다.');
          return;
        }
        this.addGraph(key);
        this.syncPresetActiveButtons();
        this.syncShapePanel();
      };
    };

    const createTextChipRow = (items, cols) => {
      const row = document.createElement('div');
      row.className = `preset-chip-grid cols-${cols}`;
      items.forEach(({ key, label, isMath }) => {
        if (!this.meta || !this.meta[key]) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isMath ? 'func-btn preset-chip-btn is-math-label' : 'func-btn preset-chip-btn';
        btn.dataset.preset = key;
        btn.innerHTML = `<span class="func-name-text">${label}</span>`;
        bindPresetClick(btn, key);
        row.appendChild(btn);
      });
      return row;
    };

    const createSquareThumbGrid = (items) => {
      const sqGrid = document.createElement('div');
      sqGrid.className = 'preset-square-grid';
      items.forEach(({ key, label, isFormula }) => {
        if (!this.meta || !this.meta[key]) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isFormula ? 'func-btn preset-square-card is-formula-label' : 'func-btn preset-square-card';
        btn.dataset.preset = key;
        btn.innerHTML = `
          <span class="preset-sq-canvas">${this._buildSquarePresetThumbnailSvg(key)}</span>
          <span class="func-name-text preset-sq-label">${label}</span>
        `;
        bindPresetClick(btn, key);
        sqGrid.appendChild(btn);
      });
      return sqGrid;
    };

    const createSectionTitle = (text) => {
      const el = document.createElement('div');
      el.className = 'preset-group-label';
      el.textContent = text;
      return el;
    };

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'preset-tab-scroll-body';

    if (activeTab === 'tab_basic') {
      // 1. 기본 · 초월 · 삼각 (텍스트 칩 — 이름만으로 즉시 식별되는 기본 함수군)
      const basicGroup = document.createElement('div');
      basicGroup.className = 'preset-group-block';
      basicGroup.appendChild(createSectionTitle('기본 함수'));
      basicGroup.appendChild(createTextChipRow([
        { key: '1st_linear', label: '일차' },
        { key: '2nd_quadratic', label: '이차' }
      ], 2));
      basicGroup.appendChild(createTextChipRow([
        { key: 'rational_basic', label: '유리' },
        { key: 'sqrt_basic', label: '무리' },
        { key: 'exp_basic', label: '지수' },
        { key: 'log_basic', label: '로그' }
      ], 4));
      basicGroup.appendChild(createTextChipRow([
        { key: 'sin_1period', label: 'sin', isMath: true },
        { key: 'cos_1period', label: 'cos', isMath: true },
        { key: 'tan_1period', label: 'tan', isMath: true }
      ], 3));
      scrollWrap.appendChild(basicGroup);

      // 2. 삼차 · 사차 개형 (3열 1:1 정사각형 개형 아틀라스 — 접선·극점 마커 정밀 구분)
      const polyGroup = document.createElement('div');
      polyGroup.className = 'preset-group-block';
      polyGroup.appendChild(createSectionTitle('삼차 · 사차 개형'));
      polyGroup.appendChild(createSquareThumbGrid([
        { key: '3rd_monotonic', label: '삼차 · 단조' },
        { key: '3rd_basic_cubic', label: '삼차 (y=x³)' },
        { key: '3rd_normal', label: '삼차 · 극값 2' },
        { key: '4th_basic_bowl', label: '사차 (y=x⁴)' },
        { key: '4th_skew', label: '사차 · 비대칭 U' },
        { key: '4th_inflection', label: '사차 · 삼중근' },
        { key: '4th_symmetric', label: '사차 · 대칭 W' },
        { key: '4th_asymmetric', label: '사차 · 비대칭 W' }
      ]));
      scrollWrap.appendChild(polyGroup);

      // 3. 평면도형 (3열 텍스트 칩)
      const geomGroup = document.createElement('div');
      geomGroup.className = 'preset-group-block';
      geomGroup.appendChild(createSectionTitle('평면도형'));
      geomGroup.appendChild(createTextChipRow([
        { key: 'geom_circle', label: '원' },
        { key: 'geom_triangle', label: '삼각형' },
        { key: 'geom_quad', label: '사각형' }
      ], 3));
      scrollWrap.appendChild(geomGroup);
    } else if (activeTab === 'tab_calculus') {
      // 미적분 1:1 정사각형 개형 아틀라스 (좌표축 · 점근선 · 원점 통과/접함 · 극점 수선 포함)
      const calcGroup = document.createElement('div');
      calcGroup.className = 'preset-group-block';
      calcGroup.appendChild(createSectionTitle('초월 · 분수 개형'));
      calcGroup.appendChild(createSquareThumbGrid([
        { key: 'killer_exp_linear', label: 'ax·e⁻ᵇˣ', isFormula: true },
        { key: 'killer_exp_quad', label: 'ax²·e⁻ᵇˣ', isFormula: true },
        { key: 'killer_log_frac', label: 'a·lnx/x', isFormula: true },
        { key: 'killer_frac_odd', label: 'ax/(x²+b)', isFormula: true }
      ]));
      scrollWrap.appendChild(calcGroup);
    }

    grid.appendChild(scrollWrap);
    this.syncPresetActiveButtons();
    this.syncShapePanel();
  }

  // --- [✨ 클린 뷰 (핸들 및 보조선 숨김, 단축키 H)] ---
  toggleCleanView(forceVal = null) {
    this.isCleanView = (forceVal !== null) ? forceVal : !this.isCleanView;

    const btnHeader = document.getElementById('btnCleanView');
    if (btnHeader) btnHeader.classList.toggle('active', this.isCleanView);

    const btnQuick = document.getElementById('btnQuickCleanView');
    if (btnQuick) btnQuick.classList.toggle('active', this.isCleanView);

    if (this.isCleanView) {
      this.showToast('✨ 클린 뷰 On: 핸들·가이드 숨김 (단축키 H)');
    } else {
      this.showToast('✏️ 편집 모드: 핸들·가이드 표시');
    }
    this.render();
  }

  // --- [📄 교재 흑백 모드 (Monochrome / Textbook Mode, 단축키 M)] ---
  initMonochromeControls() {
    const btnHeader = document.getElementById('btnMonochromeMode');
    if (btnHeader) {
      btnHeader.onclick = () => this.toggleMonochromeMode();
    }
  }

  toggleMonochromeMode(forceVal = null) {
    const nextState = (forceVal !== null) ? forceVal : !this.isMonochromeMode;
    if (this.isMonochromeMode === nextState) return;

    this.isMonochromeMode = nextState;

    const btnHeader = document.getElementById('btnMonochromeMode');
    if (btnHeader) {
      btnHeader.classList.toggle('active', this.isMonochromeMode);
    }

    if (this.isMonochromeMode) {
      // 흑백 모드 진입: 현재 활성 테마 백업 및 라이트/흑백 전용 CSS 클래스 적용
      this.preMonoThemeKey = this.currentThemeKey;
      document.body.classList.add('theme-light', 'mode-monochrome');
    } else {
      // 흑백 모드 해제: 이전 테마 복원
      document.body.classList.remove('mode-monochrome');
      const targetTheme = this.preMonoThemeKey || this.currentThemeKey;
      const theme = this.canvasThemes[targetTheme];
      if (theme && !theme.isLight) {
        document.body.classList.remove('theme-light');
      }
    }

    this._inkBakeDirty = true;
    if (this._hasPrimaryGraphCard && typeof this.renderPipGraphCard === 'function') {
      this.renderPipGraphCard('primary');
    }
    if (Array.isArray(this.extraGraphCards) && typeof this.renderPipGraphCard === 'function') {
      this.extraGraphCards.forEach(c => {
        if (c) this.renderPipGraphCard(c);
      });
    }
    if (typeof this.renderProblemCardCanvas === 'function') this.renderProblemCardCanvas();
    if (typeof this.renderGraphCardCanvas === 'function') this.renderGraphCardCanvas();
    if (Array.isArray(this.extraProblemCards)) {
      this.extraProblemCards.forEach(c => {
        if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
      });
    }
    if (Array.isArray(this.extraGraphCards)) {
      this.extraGraphCards.forEach(c => {
        if (c && c.el && typeof c.el._renderCardInkCanvas === 'function') c.el._renderCardInkCanvas();
      });
    }
    this.render();
  }

  // ==========================================================================
  // [🎛️ 상단·우측·좌측 툴바/드로어 컨트롤 · 구간분할(Piecewise) · 4분할 N축 스튜디오]
  // ==========================================================================
  bindControls() {
    // ✨ 클린 뷰 토글 버튼
    const btnClean = document.getElementById('btnCleanView');
    if (btnClean) {
      btnClean.onclick = () => this.toggleCleanView();
    }

    // 그래프 추가 버튼
    const btnAdd = document.getElementById('btnAddGraph');
    if (btnAdd) {
      btnAdd.onclick = () => this.addGraph();
    }

    // 🗑️ 모든 그래프 전체 비우기 (새 캔버스)
    const btnClearAll = document.getElementById('btnClearAllGraphs');
    if (btnClearAll) {
      btnClearAll.onclick = () => this.clearAllGraphs();
    }

    // 카테고리 탭 (3탭: 기본·도형 | 미적분 | 내 그래프)
    document.querySelectorAll('#panelPresets .cat-tab-btn').forEach(tab => {
      tab.onclick = (e) => {
        const btn = e.currentTarget || (e.target && e.target.closest ? e.target.closest('.cat-tab-btn') : e.target);
        if (!btn) return;
        const nextCat = this.normalizePresetTab(btn.dataset.cat);
        document.querySelectorAll('#panelPresets .cat-tab-btn').forEach(t => {
          t.classList.toggle('active', t.dataset.cat === nextCat);
        });
        this._currentCat = nextCat;
        this.renderFuncList();
        if (this.isAudioRecording) {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
      };
    });

    // 절댓값 토글 (체크박스 및 원터치 버튼 양방향 지원)
    const btnToggleAbs = document.getElementById('btnToggleAbs');
    if (btnToggleAbs) {
      btnToggleAbs.onclick = () => this.toggleAbsolute();
    }

    const chkAbs = document.getElementById('chkAbs');
    if (chkAbs) {
      chkAbs.onchange = (e) => {
        if (!this.activeGraph) return;
        this.pushHistoryState();
        this.activeGraph.isAbsolute = e.target.checked;
        if (!e.target.checked) {
          this.activeGraph.transforms = [];
          this.activeGraph.freezeOffset = { x: 0, y: 0 };
        }
        this.syncControls();
        this.render();
      };
    }

    // ➕ 무한 다단 절댓값 다시 접기 버튼
    const btnFoldAgain = document.getElementById('btnFoldAgain');
    if (btnFoldAgain) {
      btnFoldAgain.onclick = () => this.foldAgain();
    }

    // [대표님 기획]: 명확하고 엄밀한 수학적 x축 대칭(y -> -y) 및 y축 대칭(x -> -x)
    document.getElementById('btnInvertV').onclick = () => {
      if (!this.activeGraph) return;
      this.pushHistoryState();
      this.engine.reflectXAxis(this.activeGraph.handles, this.activeGraph.type);
      this.showToast('↕️ x축 대칭 완료!');
      this.render();
    };
    document.getElementById('btnInvertH').onclick = () => {
      if (!this.activeGraph) return;
      this.pushHistoryState();
      this.engine.reflectYAxis(this.activeGraph.handles, this.activeGraph.type);
      this.showToast('↔️ y축 대칭 완료!');
      this.render();
    };

    const btnInv = document.getElementById('btnCloneInverse');
    if (btnInv) {
      btnInv.onclick = () => this.cloneInverseGraph();
    }

    const btnDup = document.getElementById('btnDuplicateGraph');
    if (btnDup) {
      btnDup.onclick = () => this.duplicateGraph();
    }

    const btnToggleLink = document.getElementById('btnToggleInverseLink');
    if (btnToggleLink) {
      btnToggleLink.onclick = () => this.toggleInverseLink();
    }

    const btnResetFz = document.getElementById('btnResetFreezeOffset');
    if (btnResetFz) {
      btnResetFz.onclick = () => {
        if (!this.activeGraph) return;
        this.pushHistoryState();
        this.activeGraph.freezeOffset = { x: 0, y: 0 };
        this.activeGraph.transforms = [];
        this.syncControls();
        this.showToast('↺ 곡선 평행이동 및 다단 변환이 원위치로 리셋되었습니다.');
        this.render();
      };
    }

    // y = x 대칭선 (항등직선) 토글
    const chkInvGuide = document.getElementById('chkInverseGuide');
    if (chkInvGuide) {
      chkInvGuide.checked = this.showInverseGuide;
      chkInvGuide.onchange = (e) => {
        this.showInverseGuide = e.target.checked;
        this.render();
      };
    }

    // 점근선 표시 토글
    const chkAsym = document.getElementById('chkAsymptotes');
    if (chkAsym) {
      chkAsym.checked = this.showAsymptotes;
      chkAsym.onchange = (e) => {
        this.showAsymptotes = e.target.checked;
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        this._refreshAllOpenPipGraphCards();
        this.render();
      };
    }

    // 좌표축(x축 / y축) 개별 표시 토글
    const btnToggleXAxis = document.getElementById('btnToggleXAxis');
    if (btnToggleXAxis) {
      btnToggleXAxis.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showXAxis = !(this.showXAxis !== false);
        this.syncAxisVisibilityUI();
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        if (this.isGraphCovered && typeof this._applyAxisVisibilityToTargetPipCard === 'function') {
          this._applyAxisVisibilityToTargetPipCard(this.showXAxis, this.showYAxis);
        }
        this.render();
      };
    }
    const btnToggleYAxis = document.getElementById('btnToggleYAxis');
    if (btnToggleYAxis) {
      btnToggleYAxis.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showYAxis = !(this.showYAxis !== false);
        this.syncAxisVisibilityUI();
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        if (this.isGraphCovered && typeof this._applyAxisVisibilityToTargetPipCard === 'function') {
          this._applyAxisVisibilityToTargetPipCard(this.showXAxis, this.showYAxis);
        }
        this.render();
      };
    }
    this.syncAxisVisibilityUI();

    // 그리드 점선 가이드 토글
    const chkGuides = document.getElementById('chkGuides');
    if (chkGuides) {
      chkGuides.checked = this.showGuides;
      chkGuides.onchange = (e) => {
        this.showGuides = e.target.checked;
        const btnGrid = document.getElementById('btnQuickGrid');
        if (btnGrid) btnGrid.classList.toggle('active', this.showGuides);
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        this._refreshAllOpenPipGraphCards();
        this.render();
      };
    }

    // 그리드 눈금 숫자 표시 토글
    const chkGridNumbers = document.getElementById('chkGridNumbers');
    if (chkGridNumbers) {
      chkGridNumbers.checked = Boolean(this.showGridNumbers);
      chkGridNumbers.onchange = (e) => {
        this.showGridNumbers = Boolean(e.target.checked);
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        this._refreshAllOpenPipGraphCards();
        this.render();
      };
    }

    // 필기 모드 가상 펜 포인터 표시 토글 (아이패드·전자칠판 OFF / 액정타블렛·PC ON)
    const chkStylus = document.getElementById('chkShowVirtualStylus');
    if (chkStylus) {
      chkStylus.checked = Boolean(this.showVirtualStylus);
      chkStylus.onchange = (e) => {
        this.toggleVirtualStylus(Boolean(e.target.checked));
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
      };
    }

    // 🎙️ 환경설정 > 녹음 볼륨 슬라이더 & ◀ ▶ 스테퍼 (20% ~ 150%, 기본 100%)
    const sliderAudioRecVol = document.getElementById('sliderAudioRecVol');
    const lblAudioRecVol = document.getElementById('lblAudioRecVol');
    const btnAudioRecVolDown = document.getElementById('btnAudioRecVolDown');
    const btnAudioRecVolUp = document.getElementById('btnAudioRecVolUp');
    this.setAudioRecordVolume = (rawVal) => {
      const num = Number(rawVal);
      const clamped = Number.isFinite(num)
        ? Math.max(20, Math.min(150, Math.round(num / 5) * 5))
        : 100;
      this.audioRecordVolume = clamped;
      if (sliderAudioRecVol) sliderAudioRecVol.value = String(clamped);
      if (lblAudioRecVol) lblAudioRecVol.textContent = `${clamped}%`;
      try {
        localStorage.setItem('graphly_audio_record_volume_v1', String(clamped));
      } catch (err) { }
      if (typeof this._applyLiveAudioRecordVolume === 'function') {
        this._applyLiveAudioRecordVolume();
      }
    };
    this.setAudioRecordVolume(this.audioRecordVolume || 100);
    if (sliderAudioRecVol) {
      sliderAudioRecVol.oninput = (e) => {
        this.setAudioRecordVolume(parseFloat(e.target.value));
      };
    }
    if (btnAudioRecVolDown) {
      btnAudioRecVolDown.onclick = (e) => {
        e.stopPropagation();
        this.setAudioRecordVolume((this.audioRecordVolume || 100) - 5);
      };
    }
    if (btnAudioRecVolUp) {
      btnAudioRecVolUp.onclick = (e) => {
        e.stopPropagation();
        this.setAudioRecordVolume((this.audioRecordVolume || 100) + 5);
      };
    }

    // 스마트 마그네틱 자석 스냅 토글 (사이드바)
    const chkSnap = document.getElementById('chkMagneticSnap');
    if (chkSnap) {
      chkSnap.checked = this.useMagneticSnap;
      chkSnap.onchange = (e) => {
        this.toggleMagneticSnap(e.target.checked);
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
      };
    }

    // 실시간 교점판독기 토글 (사이드바)
    const chkIntersect = document.getElementById('chkIntersection');
    if (chkIntersect) {
      chkIntersect.checked = this.useIntersectionDetector;
      chkIntersect.onchange = (e) => {
        this.toggleIntersectionDetector(e.target.checked);
      };
    }

    // 수학적 1:1 정비율 상시 영구 고정 (lockAspect = true)
    this.lockAspect = true;

    // 뷰파인더 켜기/끄기 토글
    const chkVf = document.getElementById('chkVf');
    if (chkVf) {
      chkVf.checked = this.useViewfinder;
      chkVf.onchange = (e) => {
        this.useViewfinder = e.target.checked;
        const btnRail = document.getElementById('btnRailToggleVf');
        if (btnRail) btnRail.classList.toggle('active', this.useViewfinder);
        const area = document.getElementById('vfControlsArea');
        if (area) area.style.opacity = this.useViewfinder ? '1' : '0.4';
        this.render();
      };
    }

    // 캡처영역 종횡비 프리셋 칩 (4:3, 1:1, 16:9, 3:4)
    document.querySelectorAll('.vf-chip[data-ar]').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.vf-chip[data-ar]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const arStr = e.target.dataset.ar;
        this.vfAspectName = arStr;
        if (arStr === '4:3') this.vfAspect = 4 / 3;
        else if (arStr === '1:1') this.vfAspect = 1.0;
        else if (arStr === '16:9') this.vfAspect = 16 / 9;
        else if (arStr === '3:4') this.vfAspect = 3 / 4;

        // [대표님 피드백 반영: 비율 전환 시 좁아서 늘려야 하는 불편함 0% 박멸! 넉넉한 황금 여백 자동 도출]
        this.vfScreenW = this.calcIdealVfWidth(this.vfAspect);
        const sl = document.getElementById('sliderVfWidth');
        if (sl) sl.value = this.vfScreenW;
        const lbl = document.getElementById('lblVfWidth');
        if (lbl) lbl.textContent = `${this.vfScreenW} px`;

        this.render();
      };
    });

    // 뷰파인더 출력 크기 슬라이더 (가로 인치/cm)
    const sliderVfSize = document.getElementById('sliderVfSize');
    if (sliderVfSize) {
      sliderVfSize.value = this.vfTargetWIn;
      sliderVfSize.oninput = (e) => {
        this.vfTargetWIn = parseFloat(e.target.value);
        const cm = (this.vfTargetWIn * 2.54).toFixed(1);
        const lbl = document.getElementById('lblVfSize');
        if (lbl) lbl.textContent = `${this.vfTargetWIn.toFixed(1)} in (${cm} cm)`;
        this.render();
      };
    }

    // 뷰파인더 화각 너비 슬라이더 (X축 줌)
    // 뷰파인더 프레임 크기 슬라이더 (화면 픽셀 조절)
    const sliderVfWidth = document.getElementById('sliderVfWidth');
    if (sliderVfWidth) {
      sliderVfWidth.value = this.vfScreenW;
      sliderVfWidth.oninput = (e) => {
        this.vfScreenW = parseFloat(e.target.value);
        const lbl = document.getElementById('lblVfWidth');
        if (lbl) lbl.textContent = `${Math.round(this.vfScreenW)} px`;
        this.render();
      };
    }

    // 뷰파인더 DPI 선택 칩
    document.querySelectorAll('.dpi-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.dpi-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.exportDPI = parseInt(e.target.dataset.dpi, 10);
        this.render();
      };
    });

    // 두께 슬라이더 & ◀ ▶ 스테퍼 (그래프 미선택 시 = 기본 생성 두께 설정 / 그래프 선택 시 = 해당 그래프만 변경 후 선택 해제 시 기본값 복원)
    const sliderLw = document.getElementById('sliderLw');
    const applyLineWidthVal = (rawVal, pushHist = false) => {
      const val = Math.max(1.0, Math.min(6.0, parseFloat(Number(rawVal).toFixed(1))));
      if (sliderLw) sliderLw.value = val;
      const lblLw = document.getElementById('lblLw');
      if (lblLw) lblLw.textContent = `${val.toFixed(1)}`;
      const isGraphSelected = Boolean(this.activeGraph && (this.isCurveSelected || this.selectedHandleIdx !== null));
      if (isGraphSelected) {
        if (pushHist) this.pushHistoryState();
        this.activeGraph.lineWidth = val;
        this.activeGraph._customLineWidth = true;
        this.render();
      } else {
        this.defaultGraphLineWidth = val;
        try { localStorage.setItem('graphly_default_graph_lw_v1', String(val)); } catch (err) { }
        if (this.graphs.length > 0) {
          if (pushHist) this.pushHistoryState();
          this.graphs.forEach(g => {
            if (g && !g._customLineWidth) g.lineWidth = val;
          });
          this.render();
        }
      }
    };
    if (sliderLw) {
      sliderLw.onpointerdown = () => { sliderLw._preSnap = this.getHistorySnapshot(); };
      sliderLw.oninput = (e) => {
        applyLineWidthVal(parseFloat(e.target.value), false);
      };
      sliderLw.onchange = () => {
        if (sliderLw._preSnap && sliderLw._preSnap !== this.getHistorySnapshot()) {
          this.undoStack.push(sliderLw._preSnap);
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
        sliderLw._preSnap = null;
      };
    }
    const btnLwDown = document.getElementById('btnLwDown');
    if (btnLwDown) {
      btnLwDown.onclick = (e) => {
        e.stopPropagation();
        const isGraphSelected = Boolean(this.activeGraph && (this.isCurveSelected || this.selectedHandleIdx !== null));
        const cur = isGraphSelected
          ? (this.activeGraph.lineWidth || this.defaultGraphLineWidth || 2.8)
          : (this.defaultGraphLineWidth || parseFloat(sliderLw ? sliderLw.value : 2.8));
        applyLineWidthVal(cur - 0.2, true);
      };
    }
    const btnLwUp = document.getElementById('btnLwUp');
    if (btnLwUp) {
      btnLwUp.onclick = (e) => {
        e.stopPropagation();
        const isGraphSelected = Boolean(this.activeGraph && (this.isCurveSelected || this.selectedHandleIdx !== null));
        const cur = isGraphSelected
          ? (this.activeGraph.lineWidth || this.defaultGraphLineWidth || 2.8)
          : (this.defaultGraphLineWidth || parseFloat(sliderLw ? sliderLw.value : 2.8));
        applyLineWidthVal(cur + 0.2, true);
      };
    }

    // 스타일 & 배경 패널 2탭 전환 ([ ✒️ 필기 · 배경 | 📈 그래프 ])
    const btnStyleTabInk = document.getElementById('btnStyleTabInk');
    const btnStyleTabGraph = document.getElementById('btnStyleTabGraph');
    const styleTabInk = document.getElementById('styleTabContentInk');
    const styleTabGraph = document.getElementById('styleTabContentGraph');
    this.switchStylePanelTab = (tabName) => {
      const isGraph = (tabName === 'graph');
      if (btnStyleTabInk) btnStyleTabInk.classList.toggle('active', !isGraph);
      if (btnStyleTabGraph) btnStyleTabGraph.classList.toggle('active', isGraph);
      if (styleTabInk) {
        styleTabInk.style.display = isGraph ? 'none' : 'flex';
        styleTabInk.classList.toggle('active', !isGraph);
      }
      if (styleTabGraph) {
        styleTabGraph.style.display = isGraph ? 'flex' : 'none';
        styleTabGraph.classList.toggle('active', isGraph);
      }
    };
    if (btnStyleTabInk) {
      btnStyleTabInk.onclick = (e) => {
        e.stopPropagation();
        this.switchStylePanelTab('ink');
      };
    }
    if (btnStyleTabGraph) {
      btnStyleTabGraph.onclick = (e) => {
        e.stopPropagation();
        this.switchStylePanelTab('graph');
      };
    }

    // 줌 슬라이더
    const sliderZoom = document.getElementById('sliderZoom');
    if (sliderZoom) {
      sliderZoom.onpointerdown = () => { sliderZoom._preSnap = this.getHistorySnapshot(); };
      sliderZoom.oninput = (e) => {
        this.zoomLevel = parseFloat(e.target.value);
        document.getElementById('lblZoom').textContent = `${Math.round(this.zoomLevel * 100)}%`;
        this.render();
      };
      sliderZoom.onchange = () => {
        if (sliderZoom._preSnap && sliderZoom._preSnap !== this.getHistorySnapshot()) {
          this.undoStack.push(sliderZoom._preSnap);
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
        sliderZoom._preSnap = null;
      };
    }

    // 컬러 피커 팔레트 & [자동 배색(1,2,3 순환) / 색상 고정] 모드 전환
    document.querySelectorAll('#graphColorPalette .color-dot').forEach(dot => {
      dot.onclick = (e) => {
        const pickedColor = e.currentTarget.dataset.color;
        if (!pickedColor) return;

        if (this.graphColorMode === 'fixed') {
          this.fixedGraphColor = pickedColor;
          try { localStorage.setItem('graphly_fixed_graph_color_v1', pickedColor); } catch (err) { }
          this.syncGraphColorPaletteUI();
          this._applyCurrentColorRuleToActiveTarget();
          if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
          return;
        }

        // 자동 배색 모드: 클릭한 색상의 번호(1, 2, 3...) 토글 및 순서 지정
        if (!Array.isArray(this.autoColorSequence) || this.autoColorSequence.length === 0) {
          this.autoColorSequence = [...(this.defaultAutoColorSequence || ['#c74440', '#2d70b3', '#388c46', '#6042a6'])];
        }
        const pickedLower = pickedColor.toLowerCase();
        const existingIdx = this.autoColorSequence.findIndex(c => (c || '').toLowerCase() === pickedLower);
        if (existingIdx !== -1) {
          if (this.autoColorSequence.length <= 1) {
            this.showToast('ℹ️ 자동 배색에는 최소 1개 이상의 색상이 필요합니다.');
            return;
          }
          this.autoColorSequence.splice(existingIdx, 1);
        } else {
          this.autoColorSequence.push(pickedColor);
        }
        this.colorPalette = [...this.autoColorSequence];
        try { localStorage.setItem('graphly_auto_color_seq_v1', JSON.stringify(this.autoColorSequence)); } catch (err) { }
        this.syncGraphColorPaletteUI();
        this._applyCurrentColorRuleToActiveTarget();
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
      };
    });

    document.querySelectorAll('.graph-color-mode-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.colorMode === (this.graphColorMode || 'auto'));
      chip.onclick = (e) => {
        e.stopPropagation();
        const mode = e.currentTarget.dataset.colorMode === 'fixed' ? 'fixed' : 'auto';
        this.graphColorMode = mode;
        try { localStorage.setItem('graphly_graph_color_mode_v1', mode); } catch (err) { }
        if (!this.fixedGraphColor) {
          this.fixedGraphColor = '#1e293b';
          try { localStorage.setItem('graphly_fixed_graph_color_v1', this.fixedGraphColor); } catch (err) { }
        }
        this.syncGraphColorPaletteUI();
        this._applyCurrentColorRuleToActiveTarget();
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        if (mode === 'fixed') {
          this.showToast('📌 색상 고정: 선택한 색상으로 그래프 색상이 고정되었습니다.');
        } else {
          this.showToast('🎨 자동 배색: 번호(1·2·3…)가 표시된 색상 순서대로 반복 배정됩니다.');
        }
      };
    });
    this.syncGraphColorPaletteUI();

    // 상단 복사 & 저장 버튼
    document.getElementById('btnCopy').onclick = () => this.copyToClipboard();
    document.getElementById('btnDownload').onclick = () => this.downloadPNG();

    // 전체화면 원버튼 토글 (전체화면 시작 ⛶ ⇄ 전체화면 종료 ✕ 단일 버튼 스왑)
    this.syncFullscreenButtonUI = (isFs = document.body.classList.contains('fullscreen-mode')) => {
      const active = Boolean(isFs);
      document.body.classList.toggle('fullscreen-mode', active);
      const btnFs = document.getElementById('btnFullscreen');
      const iconEnter = document.getElementById('iconFullscreenEnter');
      const iconExit = document.getElementById('iconFullscreenExit');
      if (btnFs) {
        btnFs.classList.toggle('active', active);
        btnFs.classList.toggle('quick-fab-exit', active);
        btnFs.title = active ? '전체화면 종료' : '전체화면';
      }
      if (iconEnter) iconEnter.style.display = active ? 'none' : 'inline-flex';
      if (iconExit) iconExit.style.display = active ? 'inline-flex' : 'none';
    };

    const toggleFullscreen = () => {
      const isEntering = !document.body.classList.contains('fullscreen-mode');
      const docEl = document.documentElement;
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (isEntering) {
        this.syncFullscreenButtonUI(true);
        if (!fsEl) {
          try {
            if (docEl.requestFullscreen) {
              docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => { docEl.requestFullscreen().catch(() => { }); });
            } else if (docEl.webkitRequestFullscreen) {
              docEl.webkitRequestFullscreen();
            }
          } catch (err) { }
        }
        this.showToast('⛶ 전체화면 모드');
      } else {
        this.syncFullscreenButtonUI(false);
        if (fsEl) {
          try {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          } catch (err) { }
        }
        this.showToast('✕ 전체화면 종료');
      }
      setTimeout(() => {
        this.resizeCanvas();
        this.render();
      }, 100);
    };

    const btnFsMain = document.getElementById('btnFullscreen');
    if (btnFsMain) btnFsMain.onclick = toggleFullscreen;

    // ESC 또는 브라우저 전체화면 해제 시 자동 동기화 (Safari webkitfullscreenchange 포함)
    const onFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (!fsEl) {
        if (!this.isWaitingForFilePicker) {
          this.syncFullscreenButtonUI(false);
        }
      } else {
        this.syncFullscreenButtonUI(true);
      }
      setTimeout(() => {
        this.resizeCanvas();
        this.render();
      }, 100);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);

    // 🌟 [대표님 13인치 액정타블렛 특화]: 상단 바 접기/펼치기 원터치 토글
    const btnCollapseHeader = document.getElementById('btnCollapseHeader');
    const headerShowTab = document.getElementById('headerShowTab');

    const toggleHeaderCollapse = (forceState) => {
      const isCurrentlyCollapsed = document.body.classList.contains('header-collapsed');
      const nextCollapsed = (typeof forceState === 'boolean') ? forceState : !isCurrentlyCollapsed;

      if (nextCollapsed) {
        document.body.classList.add('header-collapsed');
        this.showToast('▲ 상단 바 숨김');
      } else {
        document.body.classList.remove('header-collapsed');
      }

      setTimeout(() => {
        this.resizeCanvas();
        this.render();
      }, 230);
    };

    if (btnCollapseHeader) {
      btnCollapseHeader.onclick = () => toggleHeaderCollapse(true);
    }
    if (headerShowTab) {
      headerShowTab.onclick = () => toggleHeaderCollapse(false);
    }

    // 우측 플로팅 퀵 액션 툴바 바인딩
    this.bindQuickToolbar();
  }

  // --- [우측 플로팅 퀵 툴바 & 칠판/바탕색 테마 바인딩] ---
  bindQuickToolbar() {
    // 👁️ [뷰어 미리보기 원클릭 전환 버튼 바인딩]
    const btnQuickOpenViewer = document.getElementById('btnQuickOpenViewer');
    if (btnQuickOpenViewer) {
      btnQuickOpenViewer.onclick = async (e) => {
        e.stopPropagation();
        await this.openCurrentWorkspaceInSmartViewer();
      };
    }

    // --- [우측 내보내기 & 공유 플라이아웃 패널 토글] ---
    const wrapExport = document.getElementById('wrapQuickExport');
    const btnExport = document.getElementById('btnExport');
    const panelExport = document.getElementById('panelQuickExport');

    if (btnExport && panelExport) {
      btnExport.onclick = (e) => {
        e.stopPropagation();
        if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
          this.closeDrawer();
        }
        panelExport.classList.remove('show');
        btnExport.classList.remove('active');
        if (this._openShareModalWithCloudPackage) {
          this._openShareModalWithCloudPackage();
        }
      };

      // 내보내기 메뉴 항목 클릭 시 패널 자동 닫기
      panelExport.querySelectorAll('.export-menu-item').forEach(item => {
        item.addEventListener('click', () => {
          panelExport.classList.remove('show');
          btnExport.classList.remove('active');
        });
      });

      document.addEventListener('click', (e) => {
        if (wrapExport && !wrapExport.contains(e.target)) {
          panelExport.classList.remove('show');
          btnExport.classList.remove('active');
        }
      });
    }

    // 호환용 테마 플라이아웃 바인딩 (숨김 호환)
    const btnThemeLegacy = document.getElementById('btnQuickTheme');
    const panelThemeLegacy = document.getElementById('panelQuickTheme');
    if (btnThemeLegacy && panelThemeLegacy) {
      btnThemeLegacy.onclick = (e) => {
        e.stopPropagation();
        panelThemeLegacy.classList.toggle('show');
        btnThemeLegacy.classList.toggle('active');
      };
    }

    // --- [우측 줌 인/아웃 버튼 바인딩 (대표님 기획: 줌 다다익선)] ---
    const btnQuickZoomIn = document.getElementById('btnQuickZoomIn');
    const btnQuickZoomOut = document.getElementById('btnQuickZoomOut');
    if (btnQuickZoomIn) btnQuickZoomIn.onclick = () => { this.zoomByStep(0.12); };
    if (btnQuickZoomOut) btnQuickZoomOut.onclick = () => { this.zoomByStep(-0.12); };

    // 좌측 서랍 패널(#panelStyle) 내 필기 펜 스타일(볼펜/만년필/붓펜) 칩 바인딩
    document.querySelectorAll('.ink-pen-style-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.penStyle === this.inkPenStyle);
      chip.onclick = (e) => {
        e.stopPropagation();
        const styleKey = e.currentTarget.dataset.penStyle;
        this.setInkPenStyle(styleKey);
      };
    });

    // 좌측 서랍 패널(#panelStyle) 내 모든 테마 칩 전체 바인딩
    document.querySelectorAll('.theme-chip').forEach(chip => {
      chip.onclick = (e) => {
        e.stopPropagation();
        const targetChip = e.currentTarget;
        const themeKey = targetChip.dataset.theme;
        this.setCanvasTheme(themeKey);
        if (panelThemeLegacy) {
          panelThemeLegacy.classList.remove('show');
          if (btnThemeLegacy) btnThemeLegacy.classList.remove('active');
        }
      };
    });

    // 클린 뷰 / 판서 모드 원터치 토글
    const btnClean = document.getElementById('btnQuickCleanView');
    if (btnClean) {
      btnClean.classList.toggle('active', this.isCleanView);
      btnClean.onclick = () => this.toggleCleanView();
    }

    // 스마트 마그네틱 자석 스냅 원터치 토글
    const btnSnap = document.getElementById('btnQuickSnap');
    if (btnSnap) {
      btnSnap.classList.toggle('active', this.useMagneticSnap);
      btnSnap.classList.toggle('snap-off', !this.useMagneticSnap);
      btnSnap.onclick = () => {
        this.toggleMagneticSnap();
      };
    }

    // 실시간 교점판독기 원터치 토글
    const btnIntersect = document.getElementById('btnQuickIntersection');
    if (btnIntersect) {
      btnIntersect.classList.toggle('active', this.useIntersectionDetector);
      btnIntersect.onclick = () => {
        this.toggleIntersectionDetector();
      };
    }

    // 그리드 점선 가이드 원터치 토글
    const btnGrid = document.getElementById('btnQuickGrid');
    if (btnGrid) {
      btnGrid.onclick = () => {
        this.showGuides = !this.showGuides;
        const chk = document.getElementById('chkGuides');
        if (chk) chk.checked = this.showGuides;
        btnGrid.classList.toggle('active', this.showGuides);
        if (typeof this.scheduleSaveUserPreferences === 'function') this.scheduleSaveUserPreferences();
        this._refreshAllOpenPipGraphCards();
        this.render();
        this.showToast(this.showGuides ? '📐 점선 그리드 가이드 켜짐' : '📐 점선 그리드 가이드 꺼짐');
      };
    }

    // 센터 원위치 정렬 (원클릭 중앙 정렬)
    const btnCenter = document.getElementById('btnQuickCenter');
    if (btnCenter) {
      btnCenter.onclick = () => {
        this.pushHistoryState();
        this.panX = 0;
        this.panY = 0;
        this.zoomLevel = 1.0;
        const slZoom = document.getElementById('sliderZoom');
        if (slZoom) slZoom.value = 1.0;
        const lblZoom = document.getElementById('lblZoom');
        if (lblZoom) lblZoom.textContent = '100%';
        this.render();
        this.showToast('🎯 그래프가 캡처영역 중앙으로 정렬되었습니다.');
      };
    }

    // ✨ 새 캔버스 (현재 작업이 있으면 이전 슬라이드에 자동 보관 후 깨끗한 다음 번호 캔버스 오픈!)
    const btnNewCanvas = document.getElementById('btnQuickNewCanvas');
    if (btnNewCanvas) {
      btnNewCanvas.onclick = () => {
        this.handleNewCanvasButtonClick();
      };
    }
    const btnClearCurrentCanvas = document.getElementById('btnClearCurrentCanvas');
    if (btnClearCurrentCanvas) {
      btnClearCurrentCanvas.onclick = () => {
        this.clearCurrentCanvasOnly();
      };
    }

    // ↺ 좌측 레일 캔버스 초기화 버튼 & 미니 선택 팝오버 ([현재 캔버스 비우기 / 전체 캔버스 초기화])
    const btnRailResetBoard = document.getElementById('btnRailResetBoard');
    const railResetPopover = document.getElementById('railResetBoardPopover');
    const btnResetPopoverCurrent = document.getElementById('btnResetPopoverCurrent');
    const btnResetPopoverAll = document.getElementById('btnResetPopoverAll');
    this.closeRailResetPopover = () => {
      if (railResetPopover) railResetPopover.style.display = 'none';
      if (btnRailResetBoard) btnRailResetBoard.classList.remove('active');
    };
    if (btnRailResetBoard && railResetPopover) {
      btnRailResetBoard.onclick = (e) => {
        e.stopPropagation();
        const isOpen = railResetPopover.style.display !== 'none';
        if (isOpen) {
          this.closeRailResetPopover();
          return;
        }
        if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
          this.closeDrawer();
        }
        const railEl = document.getElementById('sidebarRail');
        if (railEl) {
          const railRect = railEl.getBoundingClientRect();
          const btnRect = btnRailResetBoard.getBoundingClientRect();
          const topOffset = Math.max(8, Math.round(btnRect.top - railRect.top - 4));
          railResetPopover.style.top = `${topOffset}px`;
        }
        railResetPopover.style.display = 'block';
        btnRailResetBoard.classList.add('active');
      };
      railResetPopover.addEventListener('pointerdown', (e) => e.stopPropagation());
      railResetPopover.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('pointerdown', (e) => {
        if (!railResetPopover || railResetPopover.style.display === 'none') return;
        if (railResetPopover.contains(e.target) || btnRailResetBoard.contains(e.target)) return;
        this.closeRailResetPopover();
      });
    }
    if (btnResetPopoverCurrent) {
      btnResetPopoverCurrent.onclick = (e) => {
        e.stopPropagation();
        this.closeRailResetPopover();
        this.clearCurrentCanvasOnly();
      };
    }
    if (btnResetPopoverAll) {
      btnResetPopoverAll.onclick = (e) => {
        e.stopPropagation();
        this.closeRailResetPopover();
        this.clearAllSlidesAndReset();
      };
    }

    // 전체화면 토글
    const btnFullscreen = document.getElementById('btnQuickFullscreen');
    if (btnFullscreen) {
      btnFullscreen.onclick = () => {
        document.getElementById('btnFullscreen').click();
      };
    }
  }

  toggleVirtualStylus(forceState) {
    this.showVirtualStylus = typeof forceState === 'boolean' ? forceState : !this.showVirtualStylus;
    try {
      localStorage.setItem('graphly_show_virtual_stylus_v1', String(this.showVirtualStylus));
    } catch (err) { }

    const chkStylus = document.getElementById('chkShowVirtualStylus');
    if (chkStylus) {
      chkStylus.checked = Boolean(this.showVirtualStylus);
    }

    if (this.showVirtualStylus && this._lastPointerEvent && this._lastPointerEvent.pointerType === 'touch') {
      this._lastPointerEvent = null;
    }
    if (!this.showVirtualStylus && this.virtualStylusEl) {
      this.virtualStylusEl.style.display = 'none';
    }
    this.updateInkCursor();

    if (this.showVirtualStylus) {
      this.showToast('🖊️ 펜 포인터 표시 켜짐 (액정타블렛·PC 권장)');
    } else {
      this.showToast('🖊️ 펜 포인터 표시 꺼짐 (아이패드·전자칠판 권장)');
    }
  }

  toggleMagneticSnap(forceState) {
    this.useMagneticSnap = typeof forceState === 'boolean' ? forceState : !this.useMagneticSnap;

    const btnSnap = document.getElementById('btnQuickSnap');
    if (btnSnap) {
      btnSnap.classList.toggle('active', this.useMagneticSnap);
      btnSnap.classList.toggle('snap-off', !this.useMagneticSnap);
    }

    const chkSnap = document.getElementById('chkMagneticSnap');
    if (chkSnap) {
      chkSnap.checked = this.useMagneticSnap;
    }

    if (this.useMagneticSnap) {
      this.showToast('🧲 스마트 마그네틱 자석 스냅 켜짐!');
    } else {
      this.showToast('🧲 마그네틱 자석 스냅 꺼짐');
    }

    this.render();
  }

  toggleIntersectionDetector(forceState) {
    this.useIntersectionDetector = typeof forceState === 'boolean' ? forceState : !this.useIntersectionDetector;

    const btn = document.getElementById('btnQuickIntersection');
    if (btn) {
      btn.classList.toggle('active', this.useIntersectionDetector);
    }

    const chk = document.getElementById('chkIntersection');
    if (chk) {
      chk.checked = this.useIntersectionDetector;
    }

    if (this.useIntersectionDetector) {
      this.startIntersectionLoop();
      this.showToast('⚡ 실시간 교점판독기 가동!');
    } else {
      this.stopIntersectionLoop();
      this.detectedIntersections = [];
      this.showToast('⚡ 교점판독기 꺼짐');
    }

    this.render();
  }

  // 🌟 [필기·지우개·카드 조작 활성 상태 통합 가드]:
  // 바탕화면 칠판, 문제 카드, 창모드 그래프 카드 중 어느 곳에서든 필기/지우개/드래그가 진행 중일 때
  // 백그라운드 오프스크린 베이킹·리빌드·교점 루프 등이 프레임 예산을 침범하지 않도록 보호합니다.
  isActivelyWritingOrInteracting() {
    return Boolean(
      this.isDrawingInk ||
      this._isDrawingCardInk ||
      this.isStylusDrawing ||
      this.isDrawingLaser ||
      this.isErasingInk ||
      this.isLassoSelecting ||
      this.isDraggingLassoSelection ||
      this.isResizingLassoSelection ||
      this._isInteractingWithPipCard ||
      this._isDraggingOrResizingAnyCard
    );
  }

  startIntersectionLoop() {
    if (this.intersectionAnimId) return;
    const animate = () => {
      if (!this.useIntersectionDetector || this.isGraphCovered) {
        this.intersectionAnimId = null;
        return;
      }
      if (!this.isActivelyWritingOrInteracting()) {
        this.intersectionAnimPhase = (Date.now() / 250) % (Math.PI * 2);
        this.render();
      }
      this.intersectionAnimId = requestAnimationFrame(animate);
    };
    this.intersectionAnimId = requestAnimationFrame(animate);
  }

  stopIntersectionLoop() {
    if (this.intersectionAnimId) {
      cancelAnimationFrame(this.intersectionAnimId);
      this.intersectionAnimId = null;
    }
  }

  // --- [📐 사각형 모드: 꼭짓점 제약 드래그 & 패널 연동] ---
  isShapeCenterLocked(g) {
    return !!g && g.type === 'geom_quad' && !!g.originCenter;
  }

  showCenterLockHint() {
    const now = Date.now();
    if (this._lastLockHint && now - this._lastLockHint < 2500) return;
    this._lastLockHint = now;
    this.showToast('🎯 원점 중심 고정 중이에요. 꼭짓점을 끌어 크기를 조절하세요!');
  }

  showShiftMorphHint() {
    const now = Date.now();
    if (this._lastShiftHint && now - this._lastShiftHint < 3000) return;
    this._lastShiftHint = now;
    this.showToast('💡 [Shift 드래그]: 원함수 기준 실시간 접힘 모핑 (|f(x)-k|)!');
  }

  // 활성 그래프의 핸들 하나를 드래그 (대칭 자석 스냅 엔진)
  dragActiveHandle(idx, x, y, altKey = false, isKeyboard = false) {
    const g = this.activeGraph;
    if (!g || !g.handles) return;

    this.symmetrySnapActive = false;

    // [대표님 핵심 기획]: 키보드 방향키 조작 시에는 자석 효과 및 모핑을 100% 완전 바이패스!
    // 마우스로 찰칵 붙은 상태에서도 방향키를 누르면 자석에 갇히지 않고 부드럽게 즉시 탈출합니다.
    if (isKeyboard) {
      this.axisSnapActiveX = false;
      this.axisSnapActiveY = false;
      this.symmetrySnapActive = false;
      this.snapActiveX = false;
      this.snapActiveY = false;
      this.snappedPoints = [];
    }

    // 2. [🧲 사차함수 좌우대칭 자석 스냅 (Symmetry Snap)] - 비대칭 사차함수(4th_asymmetric) 전용!
    // (대칭형 4th_symmetric은 이미 수학 엔진 레벨에서 100% 대칭이므로 이 스냅 검사를 타면 직전 프레임 대칭 좌표와 무한 루프로 충돌하여 뚝뚝 끊김 발생 -> 완전 제외)
    if (!altKey && !isKeyboard && g.type === '4th_asymmetric' && g.handles.length >= 3) {
      if (idx === 0 || idx === 2) {
        const oppIdx = idx === 0 ? 2 : 0;
        const oppH = g.handles[oppIdx];
        const centerH = g.handles[1];
        const effSpanY = this.ySpan / this.zoomLevel;
        const unitScale = (this.screenHeight / 2) / effSpanY;

        // A. 높이 자석 스냅 (반대편 극소와 y값 일치)
        const diffY = Math.abs(y - oppH.y);
        if (diffY * unitScale < 14) {
          y = oppH.y;
          this.symmetrySnapActive = true;
          this.symmetrySnapY = oppH.y;
          this.snappedPoints.push({ x: x, y: oppH.y, label: '⚖️ 좌우대칭 극소 높이 일치' });
        }

        // B. 간격 자석 스냅 (중앙 극대 기준 좌우 거리 일치)
        const oppDist = Math.abs(oppH.x - centerH.x);
        const currDist = Math.abs(x - centerH.x);
        if (Math.abs(currDist - oppDist) * unitScale < 14) {
          x = idx === 0 ? centerH.x - oppDist : centerH.x + oppDist;
          this.snappedPoints.push({ x: x, y: y, label: '⚖️ 좌우대칭 간격 일치' });
        }
      }
    }

    // 3. 기하 엔진 핸들 변형 적용
    const constrained = g.type === 'geom_quad' && g.handles.length === 4 &&
      ((g.shapeMode && g.shapeMode !== 'free') || g.originCenter);
    if (constrained) {
      this.engine.dragQuad(g.handles, idx, x, y, g.shapeMode || 'free', !!g.originCenter, !altKey && !isKeyboard);
    } else {
      this.engine.dragHandle(g.handles, g.type, idx, x, y, altKey, isKeyboard);
    }

    // 4. [🔗 역함수 대칭 연동: 전치(Group 3)는 1:1 미러링, 표준 역함수/도형(Group 1·2)은 x ↔ y 스왑]
    const partner = this.getLinkedPartner(g);
    if (partner && partner.handles && partner.handles.length === g.handles.length) {
      const isTransposedPair = (Boolean(g.isTransposedYX) !== Boolean(partner.isTransposedYX));
      g.handles.forEach((h, hIdx) => {
        const ph = partner.handles[hIdx];
        if (!ph) return;
        if (isTransposedPair) {
          ph.x = parseFloat(h.x.toFixed(3));
          ph.y = parseFloat(h.y.toFixed(3));
          ph.type = h.type;
          if (h.name) ph.name = h.name;
          ph.reflectX = Boolean(h.reflectX);
          ph.reflectY = Boolean(h.reflectY);
          if (h.fn) ph.fn = h.fn;
          if (h.rawExpr !== undefined) ph.rawExpr = h.rawExpr;
        } else {
          ph.x = parseFloat(h.y.toFixed(3));
          ph.y = parseFloat(h.x.toFixed(3));
          if (h.type) ph.type = h.type;
          if (h.name) ph.name = h.name;
        }
      });
    }
  }

  syncShapePanel() {
    const panel = document.getElementById('quadModePanel');
    if (!panel) return;
    const isBasicTab = (this.normalizePresetTab(this._currentCat) === 'tab_basic');
    const ctx = this._resolvePresetTargetContext();
    const g = ctx ? ctx.g : null;
    const isQuad = Boolean(isBasicTab && g && g.type === 'geom_quad');
    panel.style.display = isQuad ? '' : 'none';
    if (!isQuad) return;
    const mode = g.shapeMode || 'free';
    document.querySelectorAll('.quad-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.qmode === mode));
    const chk = document.getElementById('chkQuadOrigin');
    if (chk) chk.checked = !!g.originCenter;
  }

  initShapeControls() {
    const modeNames = {
      free: '자유', parallelogram: '평행사변형', rectangle: '직사각형', rhombus: '마름모', square: '정사각형'
    };
    const syncQuadPartnerInGraphList = (g, graphsList) => {
      if (!g || !g.linkedInverseId || !Array.isArray(graphsList)) return;
      const partner = graphsList.find(item => item && item.id === g.linkedInverseId);
      if (!partner || partner.type !== 'geom_quad' || !Array.isArray(partner.handles) || partner.handles.length !== g.handles.length) return;
      partner.shapeMode = g.shapeMode || 'free';
      partner.originCenter = Boolean(g.originCenter);
      const isTransposedPair = (Boolean(g.isTransposedYX) !== Boolean(partner.isTransposedYX));
      g.handles.forEach((h, i) => {
        if (!partner.handles[i]) return;
        partner.handles[i].x = isTransposedPair ? h.x : h.y;
        partner.handles[i].y = isTransposedPair ? h.y : h.x;
      });
    };

    const applyQuadMutation = (mutateFn, undoMsg, redoMsg, toastMsg) => {
      const ctx = this._resolvePresetTargetContext();
      const g = ctx ? ctx.g : null;
      if (!g || g.type !== 'geom_quad') return;

      if (ctx.isBoardPip && ctx.cardRef && ctx.snap) {
        if (typeof this._pushWorkspaceUndoSnapshot === 'function') {
          this._pushWorkspaceUndoSnapshot(undoMsg, redoMsg);
        }
        mutateFn(g);
        syncQuadPartnerInGraphList(g, ctx.snap.graphs);
        ctx.snap.selectedHandleIdx = null;
        if (typeof this._savePipCardSnapshot === 'function') this._savePipCardSnapshot(ctx.cardRef, ctx.snap);
        this.syncShapePanel();
        if (typeof this.syncPipCardLockUI === 'function') this.syncPipCardLockUI(ctx.cardRef);
        if (typeof this.renderPipGraphCard === 'function') this.renderPipGraphCard(ctx.cardRef);
        if (typeof this.scheduleBakePipGraphCardToImg === 'function') this.scheduleBakePipGraphCardToImg(ctx.cardRef);
        if (this.isAudioRecording && typeof this._recordAudioWorkspaceStateIfNeeded === 'function') {
          this._recordAudioWorkspaceStateIfNeeded(true);
        }
        if (toastMsg) this.showToast(toastMsg);
        return;
      }

      this.pushHistoryState();
      mutateFn(g);
      syncQuadPartnerInGraphList(g, this.graphs);
      this.selectedHandleIdx = null;
      this.syncShapePanel();
      this.updateIntersections();
      if (toastMsg) this.showToast(toastMsg);
      this.render();
    };

    document.querySelectorAll('.quad-mode-btn').forEach(btn => {
      btn.onclick = () => {
        const nextMode = btn.dataset.qmode;
        applyQuadMutation(
          (g) => {
            g.shapeMode = nextMode;
            this.engine.applyQuadMode(g.handles, g.shapeMode, !!g.originCenter);
          },
          '↺ 사각형 모드 변경이 취소되었습니다',
          '↻ 사각형 모드 변경 다시 실행됨',
          `📐 ${modeNames[nextMode]} 모드! 꼭짓점을 끌어 보세요.`
        );
      };
    });

    const chkOrigin = document.getElementById('chkQuadOrigin');
    if (chkOrigin) {
      chkOrigin.onchange = (e) => {
        const checked = Boolean(e.target.checked);
        applyQuadMutation(
          (g) => {
            g.originCenter = checked;
            this.engine.applyQuadMode(g.handles, g.shapeMode || 'free', g.originCenter);
          },
          '↺ 원점 중심 고정 변경이 취소되었습니다',
          '↻ 원점 중심 고정 변경 다시 실행됨',
          checked ? '🎯 원점 중심 고정 ON (점대칭)' : '🎯 원점 중심 고정 해제'
        );
      };
    }

    // 원클릭: 원점 중심 마름모 |x|/a + |y|/b = 1  (꼭짓점이 좌표축 위)
    const btnDiamond = document.getElementById('btnQuadDiamond');
    if (btnDiamond) {
      btnDiamond.onclick = () => {
        applyQuadMutation(
          (g) => {
            g.shapeMode = 'rhombus';
            g.originCenter = true;
            const pts = [[2, 0], [0, 2], [-2, 0], [0, -2]];
            g.handles.forEach((h, i) => { h.x = pts[i][0]; h.y = pts[i][1]; });
          },
          '↺ 원점 중심 마름모 변환이 취소되었습니다',
          '↻ 원점 중심 마름모 변환 다시 실행됨',
          '🔷 원점 중심 마름모 완성! 꼭짓점을 축 방향으로 끌어 보세요.'
        );
      };
    }
  }

  // --- [📐 Figma/Canva 스타일 56px 슬림 아이콘 독 레일 & 플로팅 서랍 (Slide-over Drawer) 제어기] ---
  initRailDrawer() {
    const rail = document.getElementById('sidebarRail');
    const drawer = document.getElementById('railDrawer');
    const titleLbl = document.getElementById('drawerTitle');
    const btnToggle = document.getElementById('btnToggleDrawer');
    const btnClose = document.getElementById('btnCloseDrawer');
    const iconToggle = document.getElementById('iconToggleDrawer');

    if (!rail || !drawer) return;

    const panelTitles = {
      panelPresets: '그래프 추가',
      panelTransform: '변환 & 대칭',
      panelPiecewise: '구간 분할',
      panelToolkit: '시각화 도구',
      panelViewfinder: '캡처 규격',
      panelSettings: '환경 설정',
      panelStyle: '스타일 & 배경'
    };

    // 🌟 [대표님 기획: 📷 캡처영역 원터치 토글 바깥 버튼]
    const btnRailVf = document.getElementById('btnRailToggleVf');
    if (btnRailVf) {
      btnRailVf.onclick = (e) => {
        e.stopPropagation();
        this.toggleViewfinder();
      };
    }

    this.activeDrawerPanel = 'panelPresets';
    this.isDrawerCollapsed = true;
    this._pipTargetCard = null;
    this._pipSessionOrigin = null;

    this.openDrawer = (panelId) => {
      if (typeof this.closeRailResetPopover === 'function') {
        this.closeRailResetPopover();
      }
      const nextPanel = panelId || this.activeDrawerPanel || 'panelPresets';
      if (nextPanel !== 'panelPresets') {
        document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
        this._pipTargetCard = null;
        this._pipSessionOrigin = null;
      }
      this.activeDrawerPanel = nextPanel;
      this.isDrawerCollapsed = false;
      rail.classList.remove('drawer-collapsed');
      const railDrawerEl = document.getElementById('railDrawer');
      if (railDrawerEl) {
        railDrawerEl.dataset.activePanel = this.activeDrawerPanel;
      }
      if (iconToggle) iconToggle.textContent = '◀';
      if (btnToggle) btnToggle.title = '\\';

      // 레일 독 버튼 활성화 상태 갱신 (카드 상단 [+]로 연 경우 해당 카드의 [+]만 활성 표시)
      document.querySelectorAll('.rail-btn[data-panel]').forEach(b => {
        if (b.dataset.panel === 'panelPresets' && this.isGraphCovered && this._pipSessionOrigin === 'card') {
          b.classList.remove('active');
        } else {
          b.classList.toggle('active', b.dataset.panel === this.activeDrawerPanel);
        }
      });

      // 서랍 헤더 타이틀 갱신
      if (titleLbl) {
        titleLbl.textContent = panelTitles[this.activeDrawerPanel] || '설정';
      }

      // 서랍 내부 패널 표시 전환
      if (this.activeDrawerPanel === 'panelPresets') {
        this.syncPresetActiveButtons();
        this.syncShapePanel();
      }
      if (this.activeDrawerPanel === 'panelToolkit' && typeof this.renderMathToolkitPanel === 'function') {
        this.renderMathToolkitPanel();
      }
      if (this.activeDrawerPanel === 'panelPiecewise' && typeof this.syncPeriodicUI === 'function') {
        this.syncPeriodicUI();
      }
      document.querySelectorAll('.drawer-panel').forEach(p => {
        const isMatch = (p.id === this.activeDrawerPanel);
        p.style.display = isMatch ? 'flex' : 'none';
        p.classList.toggle('active', isMatch);
      });

      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }

      // 캔버스 크기는 고정(Overlay)되므로 리사이즈 없이 즉시 렌더링 (RAF 배치 렌더링)
      this.requestRender();
    };

    this.closeDrawer = () => {
      this.isDrawerCollapsed = true;
      rail.classList.add('drawer-collapsed');
      if (iconToggle) iconToggle.textContent = '▶';
      if (btnToggle) btnToggle.title = '\\';

      // 레일 독 버튼 활성화 해제
      document.querySelectorAll('.rail-btn[data-panel]').forEach(b => {
        b.classList.remove('active');
      });
      document.querySelectorAll('.btn-card-add-func.active').forEach(b => {
        b.classList.remove('active');
      });
      this._pipTargetCard = null;
      this._pipSessionOrigin = null;

      if (this.isAudioRecording) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }

      // 캔버스 크기는 고정(Overlay)되므로 리사이즈 없이 즉시 렌더링 (RAF 배치 렌더링)
      this.requestRender();
    };

    this.toggleDrawer = () => {
      if (this.isDrawerCollapsed) {
        if ((this.activeDrawerPanel || 'panelPresets') === 'panelPresets' && this.isGraphCovered) {
          document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
          this._pipTargetCard = 'new';
          this._pipSessionOrigin = 'rail';
        }
        this.openDrawer(this.activeDrawerPanel);
      } else {
        this.closeDrawer();
      }
    };

    // 레일 독 버튼 클릭 이벤트 바인딩 (좌측 [+] 및 모든 레일 버튼 깔끔한 열기 ↔ 닫기 토글)
    document.querySelectorAll('.rail-btn[data-panel]').forEach(btn => {
      btn.onclick = () => {
        const targetPanel = btn.dataset.panel;
        if (!this.isDrawerCollapsed && this.activeDrawerPanel === targetPanel) {
          this.closeDrawer();
          return;
        }
        if (targetPanel === 'panelPresets' && this.isGraphCovered) {
          document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
          this._pipTargetCard = 'new';
          this._pipSessionOrigin = 'rail';
        }
        this.openDrawer(targetPanel);
      };
    });

    if (btnClose) {
      btnClose.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      btnClose.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.closeDrawer();
      };
    }

    if (btnToggle) {
      btnToggle.onclick = () => this.toggleDrawer();
    }

    // [대표님 핵심 UX 기획]:
    // 1) 그래프 추가(panelPresets)·구간 분할(panelPiecewise)·시각화 도구(panelToolkit)·스타일 & 배경(panelStyle)·환경 설정(panelSettings)은
    //    한 번 열리면 바깥 영역 터치/클릭으로 닫히지 않고 [✕] 버튼(또는 활성 아이콘 재탭 / 도구 실행)으로 닫도록 고정!
    // 2) 기타 보조 서랍은 바깥 클릭 시 자동 닫히되, 아이패드 애플펜슬 손날(팜 리젝션) 오터치는 무시!
    window.addEventListener('pointerdown', (e) => {
      if (this.isDrawerCollapsed) return;
      if (
        this.activeDrawerPanel === 'panelPresets' ||
        this.activeDrawerPanel === 'panelPiecewise' ||
        this.activeDrawerPanel === 'panelToolkit' ||
        this.activeDrawerPanel === 'panelStyle' ||
        this.activeDrawerPanel === 'panelSettings'
      ) {
        return;
      }
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      // 서랍 내부, 좌측 레일 버튼, 또는 그래프 카드 상단 [+] 함수 추가 버튼 클릭 시에는 유지
      if (target.closest('#railDrawer') || target.closest('#sidebarRail') || target.closest('.btn-card-add-func')) return;
      // 아이패드 펜슬 필기 중 손날(광폭 터치 / 팜 리젝션 활성)이 캔버스에 닿았을 때는 서랍이 저절로 닫히지 않도록 보호
      const isTouch = Boolean(e && (e.pointerType === 'touch' || (e.touches && e.touches.length > 0 && !e.pointerType)));
      const isWidePalm = Boolean(e && e.pointerType === 'touch' && ((e.width || 0) >= 32 || (e.height || 0) >= 32));
      if (isTouch && (isWidePalm || (typeof this.isStylusPalmRejectionActive === 'function' && this.isStylusPalmRejectionActive()))) {
        if (target === this.canvas || target.id === 'graphCanvas' || target.closest('.problem-card-widget')) {
          return;
        }
      }
      // 스마트 수식 입력 모달, 요금제 모달 등 팝업 모달 내부 클릭 시에는 서랍 유지
      if (
        target.closest('#modalSmartInput') ||
        target.closest('#proPricingModal') ||
        target.closest('.smart-modal-backdrop') ||
        target.closest('.modal-overlay')
      ) {
        return;
      }
      // 🌟 [아이패드 가시 영역 초점 동기화]: 서랍이 열린 채 [필기 복귀] / [새 카드로 추가]를 터치할 때
      // pointerdown(캡처 단계)에서 서랍이 먼저 닫히기 직전의 차폐 폭을 기록해 click 전환 시 가시 영역 센터를 정확히 계산!
      if (!this.isGraphCovered && (target.closest('#btnReturnToCoveredBoard') || target.closest('#btnAddNewPipCardFromGraph'))) {
        const rdEl = document.getElementById('railDrawer');
        const cRect = (this.canvas && typeof this.canvas.getBoundingClientRect === 'function')
          ? this.canvas.getBoundingClientRect()
          : { left: 0 };
        if (rdEl && typeof rdEl.getBoundingClientRect === 'function') {
          const rdRect = rdEl.getBoundingClientRect();
          const occRight = Math.round(rdRect.right - (cRect.left || 0));
          if (occRight > 80) {
            this._preReturnDrawerOccludedRight = occRight;
            this._preReturnDrawerClosedAt = Date.now();
          }
        }
      }
      this.closeDrawer();
    }, true);

    // 단축키: ESC 서랍 닫기
    // (G, \, 1~5 등 일반 기능 단축키는 개인 맞춤 단축키 엔진 handleCustomShortcutKeyDown에서 통합 처리)
    window.addEventListener('keydown', (e) => {
      if (this.isShortcutSettingsModalOpen && this.isShortcutSettingsModalOpen()) return;
      if (this.isNAxisStudioOpen || this.isMathToolkitOpen || this._activeToolkitModalId) return;
      const tag = e.target && e.target.tagName ? e.target.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;

      if (e.key === 'Escape' && !this.isDrawerCollapsed) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.closeDrawer();
        return;
      }
    });

    // [대표님 기획]: 첫 시작화면은 메뉴를 접은 상태로 광활한 넓은 칠판에서 시작!
    this.closeDrawer();
  }

  // --- [✂️ 캔버스 직관적 N-구간 다중 분할 (Canvas Multi-Boundary Piecewise) 엔진] ---
  initPiecewiseControls() {
    const chk = document.getElementById('chkPiecewise');
    const btnQuick = document.getElementById('btnQuickPiecewise');
    const btnAdd = document.getElementById('btnPwAddBoundary');

    // 퀵 버튼 클릭 시: 꺼져있으면 1개 선으로 시작, 켜져있으면 세로선 추가!
    if (btnQuick) {
      btnQuick.onclick = () => {
        this.addPiecewiseBoundary();
      };
    }

    // 사이드바 분할선 추가 버튼 (+ 선추가) -> 연속 2~3개 추가 편의를 위해 서랍 열린 상태 유지 ([✕]로 수동 닫기)
    if (btnAdd) {
      btnAdd.onclick = () => {
        this.addPiecewiseBoundary();
      };
    }

    // 마스터 온/오프 체크박스
    if (chk) {
      chk.onchange = (e) => {
        if (e.target.checked) {
          if (!this.piecewiseBoundaries || this.piecewiseBoundaries.length === 0) {
            this.addPiecewiseBoundary();
          } else {
            this.usePiecewise = true;
            this.render();
          }
        } else {
          this.usePiecewise = false;
          this.isPiecewiseLocked = false;
          if (btnQuick) btnQuick.classList.remove('active');
          const popover = document.getElementById('pwRegionPopover');
          if (popover) popover.style.display = 'none';
          this.showToast('✂️ 구간 분할 합성 꺼짐');
          this.render();
        }
      };
    }

    // [대표님 핵심 기획: 스마트 인터랙티브 고스트]:
    // 체크박스 버튼 없이, 화면에서 특정 곡선을 클릭/선택하면 그 곡선만 점선이 나오고,
    // 다른 곡선을 클릭하면 그 곡선만 점선이 나오며, 빈 공간 클릭 시 점선이 싹 사라짐!

    // 🎯 교점 스냅 -> 스냅 후 추가 조작(선 추가·주기 반복 등)을 위해 서랍 열린 상태 유지 ([✕]로 수동 닫기)
    const btnSnap = document.getElementById('btnPwSnap');
    if (btnSnap) {
      btnSnap.onclick = () => {
        this.snapPwToIntersection();
      };
    }

    // 🔁 [대표님 핵심 기획: 전구간 주기 반복 컨트롤 바인딩 (서랍 내 슬라이더 + 끝점 맞물림)]
    const chkPeriodic = document.getElementById('chkPwPeriodic');
    if (chkPeriodic) {
      chkPeriodic.onchange = (e) => {
        this.togglePiecewisePeriodic(e.target.checked);
        // 주기 반복을 켰을 때는 바로 아래 슬라이더와 [끝점 맞물림]을 조작할 수 있도록 서랍 유지!
      };
    }

    const btnStepMinus = document.getElementById('btnPwStepMinus');
    if (btnStepMinus) {
      btnStepMinus.onclick = (e) => {
        e.stopPropagation();
        const nextQ = Math.round(((this.periodicStepY || 0) - 0.1) * 100) / 100;
        this.setPeriodicStep(nextQ);
      };
    }

    const btnStepPlus = document.getElementById('btnPwStepPlus');
    if (btnStepPlus) {
      btnStepPlus.onclick = (e) => {
        e.stopPropagation();
        const nextQ = Math.round(((this.periodicStepY || 0) + 0.1) * 100) / 100;
        this.setPeriodicStep(nextQ);
      };
    }

    const sliderPwStep = document.getElementById('sliderPwStep');
    if (sliderPwStep) {
      sliderPwStep.addEventListener('pointerdown', () => {
        this.pushHistoryState();
      });
      sliderPwStep.oninput = (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val)) val = 0;
        // 0 근처 및 연속 끝점 맞물림 값(qMatch) 근처에서 스마트 자석 스냅!
        const qMatch = this.getPeriodicMatchStep();
        if (Math.abs(val) < 0.08) {
          val = 0;
        } else if (qMatch !== null && Math.abs(val - qMatch) < 0.15) {
          val = qMatch;
        }
        this.periodicStepY = Math.round(val * 100) / 100;
        this.syncPeriodicUI();
        this.updatePwDescBadge();
        this.requestRender();
      };
    }

    const btnStepMatch = document.getElementById('btnPwStepMatch');
    if (btnStepMatch) {
      btnStepMatch.onclick = (e) => {
        e.stopPropagation();
        this.matchPeriodicEndpoints();
      };
    }

    const btnStepReset = document.getElementById('btnPwStepReset');
    if (btnStepReset) {
      btnStepReset.onclick = (e) => {
        e.stopPropagation();
        this.setPeriodicStep(0);
      };
    }

    // ↺ [대표님 기획]: 구간 분할 완전 초기화 (x=0 단일선 & f1/f2 리셋)
    const btnReset = document.getElementById('btnPwReset');
    if (btnReset) {
      btnReset.onclick = () => this.resetPiecewise();
    }

    this.updatePwDescBadge();
  }

  // [대표님 핵심 기획: ✂️ 구간 분할 완전 초기화 (x=0 단일선 & f1/f2 또는 비움/f1 배정)]
  resetPiecewise() {
    this.pushHistoryState();
    this.piecewiseBoundaries = [0.0];
    this.piecewiseFuncMap = (this.graphs.length === 1) ? [-1, 0] : [0, 1];
    this.piecewiseInclusions = ['right'];
    this.pwK = 0.0;
    this.selectedPwBoundaryIdx = null;
    this.usePiecewise = true;
    this.isPiecewisePeriodic = false;
    this.isPiecewiseLocked = false;
    this.periodicStepY = 0.0;
    this.syncPeriodicUI();

    // 그래프 0개일 때만 기본 함수 추가
    if (this.graphs.length === 0) {
      this.addGraph('2nd_quadratic');
      this.showToast('💡 구간 분할을 적용할 기본 함수가 추가되었습니다!');
    }

    const btnQuick = document.getElementById('btnQuickPiecewise');
    if (btnQuick) btnQuick.classList.add('active');
    const chk = document.getElementById('chkPiecewise');
    if (chk) chk.checked = true;
    const container = document.getElementById('pwControls');
    if (container) container.style.display = 'flex';
    const popover = document.getElementById('pwRegionPopover');
    if (popover) popover.style.display = 'none';
    this._openPwRegionIdx = null;

    this.showToast('↺ 구간 분할이 기본 상태(x=0)로 깔끔히 초기화되었습니다!');
    this.updatePwDescBadge();
    this.render();
  }

  // 세로 분할선 추가 (아이콘 클릭 시마다 N-분할 확장)
  addPiecewiseBoundary() {
    this.pushHistoryState();
    if (!this.piecewiseBoundaries) this.piecewiseBoundaries = [];
    if (!this.piecewiseFuncMap) this.piecewiseFuncMap = [];

    // 그래프 0개일 때만 기본 함수 추가
    if (this.graphs.length === 0) {
      this.addGraph('2nd_quadratic');
      this.showToast('💡 구간 분할을 적용할 기본 함수가 추가되었습니다!');
    }

    this.isPiecewiseLocked = false;
    if (this.piecewiseBoundaries.length === 0) {
      this.usePiecewise = true;
      this.piecewiseBoundaries = [0.0];
      // 그래프 1개일 때는 [비움, f1]으로 자동 배정 (오른쪽 절반 개형 즉시 완성!)
      this.piecewiseFuncMap = (this.graphs.length === 1) ? [-1, 0] : [0, 1];
      this.piecewiseInclusions = ['right'];
      this.pwK = 0.0;
      this.selectedPwBoundaryIdx = 0;
      this.showToast('✂️ 구간 분할 시작! (세로선 1개 = 2개 영역). [+ 선 추가]를 누르면 선이 계속 추가됩니다.');
    } else {
      // 새로운 세로선 위치 결정 (마지막 선 + 2.0 또는 화면 범위 내)
      const lastX = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
      let newX = Math.round((lastX + 2.0) * 10) / 10;
      if (newX > (this.xSpan / this.zoomLevel) * 0.8) {
        newX = Math.round((this.piecewiseBoundaries[0] - 2.0) * 10) / 10;
      }

      this.piecewiseBoundaries.push(newX);
      this.piecewiseBoundaries.sort((a, b) => a - b);
      const insertedIdx = this.piecewiseBoundaries.indexOf(newX);

      // 새 영역에 배정할 함수 (다음 순번 함수)
      const nextGIdx = this.piecewiseFuncMap.length % Math.max(1, this.graphs.length);
      this.piecewiseFuncMap.splice(insertedIdx + 1, 0, nextGIdx);
      if (!this.piecewiseInclusions) this.piecewiseInclusions = [];
      this.piecewiseInclusions.splice(insertedIdx, 0, 'right');

      this.selectedPwBoundaryIdx = insertedIdx;
      this.showToast(`✂️ 분할선 추가! (총 ${this.piecewiseBoundaries.length}개 선 ➔ ${this.piecewiseBoundaries.length + 1}개 영역 분할)`);
    }

    this.usePiecewise = true;
    this.isCurveSelected = false;
    this.selectedHandleIdx = null;
    if (this.isInkMode && this.activeInkTool !== 'select') {
      this.setActiveInkTool('select');
    }
    const btnQuick = document.getElementById('btnQuickPiecewise');
    if (btnQuick) btnQuick.classList.add('active');
    const chk = document.getElementById('chkPiecewise');
    if (chk) chk.checked = true;

    const container = document.getElementById('pwControls');
    if (container) container.style.display = 'flex';
    const popover = document.getElementById('pwRegionPopover');
    if (popover) popover.style.display = 'none';
    this._openPwRegionIdx = null;

    this.syncPeriodicUI();
    this.updatePwDescBadge();
    this.render();
  }

  // 세로 분할선 삭제 (배지의 ✕ 클릭 시)
  removePiecewiseBoundary(delIdx) {
    if (!this.piecewiseBoundaries || delIdx < 0 || delIdx >= this.piecewiseBoundaries.length) return;
    this.pushHistoryState();
    this.piecewiseBoundaries.splice(delIdx, 1);
    if (this.piecewiseFuncMap) {
      this.piecewiseFuncMap.splice(delIdx + 1, 1);
    }
    if (this.piecewiseInclusions) {
      this.piecewiseInclusions.splice(delIdx, 1);
    }

    const popover = document.getElementById('pwRegionPopover');
    if (popover) popover.style.display = 'none';

    if (this.piecewiseBoundaries.length < 2) {
      this.isPiecewisePeriodic = false;
      this.syncPeriodicUI();
    }
    if (this.piecewiseBoundaries.length === 0) {
      this.usePiecewise = false;
      this.isPiecewiseLocked = false;
      this.isPiecewisePeriodic = false;
      const btnQuick = document.getElementById('btnQuickPiecewise');
      if (btnQuick) btnQuick.classList.remove('active');
      const chk = document.getElementById('chkPiecewise');
      if (chk) chk.checked = false;
      const container = document.getElementById('pwControls');
      if (container) container.style.display = 'none';
      this.showToast('✂️ 모든 분할선이 삭제되어 기본 모드로 전환되었습니다.');
    } else {
      this.showToast(`✂️ 분할선 삭제 완료! (${this.piecewiseBoundaries.length}개 선 남음)`);
    }
    this.updatePwDescBadge();
    this.render();
  }

  // 캔버스 상단 함수 변경 팝오버 열기 (같은 영역 칩 다시 클릭 시 접기 토글 지원)
  openRegionFuncMenu(regionIdx, x, y, forceOpen = false) {
    const popover = document.getElementById('pwRegionPopover');
    if (!popover) return;

    if (!forceOpen && popover.style.display !== 'none' && this._openPwRegionIdx === regionIdx) {
      popover.style.display = 'none';
      this._openPwRegionIdx = null;
      if (this.isAudioRecording && !this._isApplyingAudioTimelineState) {
        this._recordAudioWorkspaceStateIfNeeded(true);
      }
      return;
    }
    this._openPwRegionIdx = regionIdx;

    popover.innerHTML = '';
    const currentGIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[regionIdx] !== undefined)
      ? this.piecewiseFuncMap[regionIdx]
      : (this.graphs.length > 0 ? (regionIdx % this.graphs.length) : -1);

    // 영역 선택 헤더 생략 (미니멀 드롭다운)

    // 🚫 [대표님 기획]: 함수 없음 (비움 / None) 옵션
    const emptyItem = document.createElement('div');
    emptyItem.className = `pw-popover-item ${currentGIdx === -1 ? 'active' : ''}`;
    emptyItem.style.borderBottom = '1px dashed rgba(255,255,255,0.1)';
    emptyItem.style.marginBottom = '2px';
    emptyItem.style.paddingBottom = '4px';

    const emptyDot = document.createElement('span');
    emptyDot.className = 'pw-popover-dot';
    emptyDot.style.backgroundColor = '#747d8c';
    emptyDot.style.boxShadow = 'none';

    const emptyLabel = document.createElement('span');
    emptyLabel.style.color = currentGIdx === -1 ? '#ff7675' : '#a4b0be';
    emptyLabel.style.fontWeight = '600';
    emptyLabel.textContent = '비움';

    emptyItem.appendChild(emptyDot);
    emptyItem.appendChild(emptyLabel);

    emptyItem.onclick = (e) => {
      e.stopPropagation();
      this.pushHistoryState();
      if (!this.piecewiseFuncMap) this.piecewiseFuncMap = [];
      this.piecewiseFuncMap[regionIdx] = -1;
      popover.style.display = 'none';
      this.updatePwDescBadge();
      this.renderLayerList();
      this.render();
      this.showToast(`🚫 영역 ${regionIdx + 1} ➔ 함수 없음 (공집합 ∅ 비움) 설정 완료!`);
    };
    popover.appendChild(emptyItem);

    this.graphs.forEach((g, gIdx) => {
      const item = document.createElement('div');
      item.className = `pw-popover-item ${gIdx === currentGIdx ? 'active' : ''}`;

      const dot = document.createElement('span');
      dot.className = 'pw-popover-dot';
      dot.style.backgroundColor = g.color;
      dot.style.color = g.color;

      const label = document.createElement('span');
      label.textContent = `f${gIdx + 1} (${this.meta[g.type]?.name || '함수'})`;

      item.appendChild(dot);
      item.appendChild(label);

      item.onclick = (e) => {
        e.stopPropagation();
        this.pushHistoryState();
        if (!this.piecewiseFuncMap) this.piecewiseFuncMap = [];
        this.piecewiseFuncMap[regionIdx] = gIdx;
        if (this.graphs[gIdx]) this.graphs[gIdx].isIndependent = false;
        popover.style.display = 'none';
        this.updatePwDescBadge();
        this.renderLayerList();
        this.render();
        this.showToast(`✨ 영역 ${regionIdx + 1} ➔ f${gIdx + 1}(x) (${this.meta[g.type]?.name}) 배정!`);
      };

      popover.appendChild(item);
    });

    // 🔁 [대표님 기획]: 구간 반복 (주기함수) 원클릭 토글 아이템
    const periodicItem = document.createElement('div');
    periodicItem.className = `pw-popover-item ${this.isPiecewisePeriodic ? 'active' : ''}`;
    periodicItem.style.borderTop = '1px dashed rgba(255,255,255,0.15)';
    periodicItem.style.marginTop = '4px';
    periodicItem.style.paddingTop = '6px';

    const periodicDot = document.createElement('span');
    periodicDot.className = 'pw-popover-dot';
    periodicDot.style.backgroundColor = this.isPiecewisePeriodic ? '#00d2d3' : '#a29bfe';
    periodicDot.style.boxShadow = this.isPiecewisePeriodic ? '0 0 6px rgba(0, 210, 211, 0.8)' : 'none';

    const periodicLabel = document.createElement('span');
    periodicLabel.style.color = this.isPiecewisePeriodic ? '#00d2d3' : '#cbd5e1';
    periodicLabel.style.fontWeight = '700';
    periodicLabel.textContent = this.isPiecewisePeriodic ? '🔁 주기 반복 ON' : '🔁 주기 반복 OFF';

    periodicItem.appendChild(periodicDot);
    periodicItem.appendChild(periodicLabel);

    periodicItem.onclick = (e) => {
      e.stopPropagation();
      this.togglePiecewisePeriodic();
      popover.style.display = 'none';
    };
    popover.appendChild(periodicItem);

    const clampX = Math.max(12, Math.min(this.screenWidth - 170, x));
    popover.style.left = `${clampX}px`;
    popover.style.top = `${y}px`;
    popover.style.display = 'flex';
    if (this.isAudioRecording && !this._isApplyingAudioTimelineState) {
      this._recordAudioWorkspaceStateIfNeeded(true);
    }
  }

  // 🔁 [대표님 핵심 기획: 전구간 주기 반복 (Periodic Piecewise Function) 컨트롤러]
  togglePiecewisePeriodic(forceState) {
    this.pushHistoryState();
    const nextState = (forceState !== undefined) ? Boolean(forceState) : !this.isPiecewisePeriodic;

    if (nextState) {
      // 주기를 형성하려면 2개 이상의 경계선이 필요
      if (!this.piecewiseBoundaries || this.piecewiseBoundaries.length < 2) {
        if (!this.piecewiseBoundaries || this.piecewiseBoundaries.length === 0) {
          this.piecewiseBoundaries = [-1.0, 1.0];
          this.piecewiseFuncMap = (this.graphs.length === 1) ? [-1, 0, -1] : [-1, 0, 1, -1];
          this.piecewiseInclusions = ['left', 'left'];
        } else if (this.piecewiseBoundaries.length === 1) {
          const b0 = this.piecewiseBoundaries[0];
          this.piecewiseBoundaries = [b0, b0 + 2.0];
          if (!this.piecewiseFuncMap || this.piecewiseFuncMap.length < 3) {
            this.piecewiseFuncMap = (this.graphs.length === 1) ? [-1, 0, -1] : [-1, 0, 1, -1];
          }
          if (!this.piecewiseInclusions) this.piecewiseInclusions = ['left', 'left'];
          while (this.piecewiseInclusions.length < 2) this.piecewiseInclusions.push('left');
        }
        this.showToast('💡 주기 T=2.0 구성을 위해 2번째 경계선이 자동 배치되었습니다!');
      }

      if (this.graphs.length > 0 && this.graphs[0].isIndependent) {
        this.graphs[0].isIndependent = false;
      }
      this.usePiecewise = true;
      this.isPiecewisePeriodic = true;
      const b0 = this.piecewiseBoundaries[0];
      const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
      const T = Math.round((bLast - b0) * 100) / 100;
      this.showToast(`🔁 전구간 주기 반복 활성화! (주기 T = ${T})`);
    } else {
      this.isPiecewisePeriodic = false;
      this.showToast('⏸️ 전구간 주기 반복 해제');
    }

    this.syncPeriodicUI();
    this.updatePwDescBadge();
    this.render();
  }

  togglePiecewiseLock(forceState) {
    this.pushHistoryState();
    this.isPiecewiseLocked = (forceState !== undefined) ? Boolean(forceState) : !this.isPiecewiseLocked;
    if (this.isPiecewiseLocked) {
      this.activePwDragIdx = null;
      this.showToast('🔒 경계선 고정! (핸들: 모양 조절 / 곡선 드래그: 전체 이동)');
    } else {
      this.showToast('🔓 경계선 고정 해제!');
    }
    this.render();
  }

  getPeriodicMatchStep() {
    if (!this.piecewiseBoundaries || this.piecewiseBoundaries.length < 2 || !this.graphs || this.graphs.length === 0) {
      return null;
    }
    const n = this.piecewiseBoundaries.length;
    const b0 = this.piecewiseBoundaries[0];
    const bLast = this.piecewiseBoundaries[n - 1];
    const rStart = 1;
    const rEnd = n - 1;
    const gIdxStart = (this.piecewiseFuncMap && this.piecewiseFuncMap[rStart] !== undefined)
      ? this.piecewiseFuncMap[rStart]
      : (1 % this.graphs.length);
    const gIdxEnd = (this.piecewiseFuncMap && this.piecewiseFuncMap[rEnd] !== undefined)
      ? this.piecewiseFuncMap[rEnd]
      : ((n - 1) % this.graphs.length);
    const gStart = (gIdxStart >= 0) ? this.graphs[gIdxStart] : null;
    const gEnd = (gIdxEnd >= 0) ? this.graphs[gIdxEnd] : null;
    if (!gStart || !gEnd) return null;

    const yStart = this.engine.evaluatePipeline(gStart, b0);
    const yEnd = this.engine.evaluatePipeline(gEnd, bLast);
    if (isNaN(yStart) || !isFinite(yStart) || isNaN(yEnd) || !isFinite(yEnd)) return null;
    return Math.round((yEnd - yStart) * 100) / 100;
  }

  matchPeriodicEndpoints() {
    if (!this.isPiecewisePeriodic) {
      this.togglePiecewisePeriodic(true);
    }
    const qMatch = this.getPeriodicMatchStep();
    if (qMatch === null) {
      this.showToast('⚠️ 맞물릴 구간 함수를 찾을 수 없습니다.');
      return null;
    }
    this.setPeriodicStep(qMatch);
    this.showToast(`🔗 양 끝점 연속 맞물림 완료! (q = ${qMatch > 0 ? '+' : ''}${qMatch})`);
    return qMatch;
  }

  setPeriodicStep(stepY) {
    this.pushHistoryState();
    const rounded = Math.round(Math.max(-10, Math.min(10, stepY)) * 100) / 100;
    this.periodicStepY = rounded;
    const sign = this.periodicStepY > 0 ? '+' : '';
    this.showToast(`🪜 계단식 높이 변화: q = ${sign}${this.periodicStepY} 설정!`);
    this.syncPeriodicUI();
    this.updatePwDescBadge();
    this.render();
  }

  syncPeriodicUI() {
    const chk = document.getElementById('chkPwPeriodic');
    if (chk) chk.checked = Boolean(this.isPiecewisePeriodic);

    const controls = document.getElementById('pwPeriodicControls');
    if (controls) controls.style.display = this.isPiecewisePeriodic ? 'block' : 'none';

    if (this.piecewiseBoundaries && this.piecewiseBoundaries.length >= 2) {
      const b0 = this.piecewiseBoundaries[0];
      const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
      const T = Math.round((bLast - b0) * 100) / 100;
      const lblT = document.getElementById('pwPeriodicPeriodLabel');
      if (lblT) lblT.textContent = `T = ${T}`;
    }

    const qVal = Math.round((this.periodicStepY || 0) * 100) / 100;
    const lblStep = document.getElementById('pwPeriodicStepLabel');
    if (lblStep) {
      const sign = qVal > 0 ? '+' : '';
      lblStep.textContent = `${sign}${qVal}`;
    }

    const sliderStep = document.getElementById('sliderPwStep');
    if (sliderStep) {
      sliderStep.value = Math.max(-6, Math.min(6, qVal));
    }
  }

  updatePwDescBadge() {
    const badge = document.getElementById('pwDescBadge');
    if (!badge) return;

    if (!this.piecewiseBoundaries || this.piecewiseBoundaries.length === 0) {
      badge.textContent = '구간 분할 비활성 상태';
      return;
    }

    const n = this.piecewiseBoundaries.length;
    const parts = [];
    for (let r = 0; r <= n; r++) {
      const gIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[r] !== undefined)
        ? this.piecewiseFuncMap[r]
        : (this.graphs.length > 0 ? (r % this.graphs.length) : -1);
      const fName = gIdx === -1 ? '비움' : `f${gIdx + 1}`;
      if (n === 1) {
        parts.push(r === 0 ? `왼쪽 : ${fName}` : `오른쪽 : ${fName}`);
      } else {
        parts.push(`구간 ${r + 1} : ${fName}`);
      }
    }
    let descText = parts.join(' | ');
    if (this.isPiecewisePeriodic && this.piecewiseBoundaries && this.piecewiseBoundaries.length >= 2) {
      const b0 = this.piecewiseBoundaries[0];
      const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
      const T = Math.round((bLast - b0) * 100) / 100;
      const qSign = (this.periodicStepY || 0) > 0 ? '+' : '';
      descText += ` | 🔁 주기 T=${T} (q=${qSign}${this.periodicStepY || 0})`;
    }
    badge.textContent = descText;
  }

  snapPwToIntersection() {
    if (this.graphs.length < 2) {
      this.showToast('⚠️ 두 개 이상의 그래프가 있어야 교점에 스냅할 수 있습니다.');
      return;
    }
    const roots = this.engine.findIntersections(this.graphs[0], this.graphs[1], { xmin: -15, xmax: 15 }, null);
    if (!roots || roots.length === 0) {
      this.showToast('⚠️ 두 그래프 사이에 교점이 없습니다.');
      return;
    }
    if (!this.piecewiseBoundaries || this.piecewiseBoundaries.length === 0) {
      this.addPiecewiseBoundary();
    }
    if (!roots || roots.length === 0) {
      this.showToast('⚠️ 두 그래프 사이에 교점이 없습니다.');
      return;
    }

    const sortedRoots = roots.map(r => r.x).sort((a, b) => a - b);

    if (this.piecewiseBoundaries.length === 1) {
      let closest = sortedRoots[0];
      let minD = Math.abs(this.piecewiseBoundaries[0] - closest);
      sortedRoots.forEach(rx => {
        const d = Math.abs(this.piecewiseBoundaries[0] - rx);
        if (d < minD) {
          minD = d;
          closest = rx;
        }
      });
      this.piecewiseBoundaries[0] = parseFloat(closest.toFixed(2));
      this.pwK = this.piecewiseBoundaries[0];
      this.showToast('🎯 교점에 칼밀착!');
    } else {
      // 다중 경계선 순차 스냅
      for (let i = 0; i < this.piecewiseBoundaries.length; i++) {
        const rootCandidate = sortedRoots[i % sortedRoots.length];
        this.piecewiseBoundaries[i] = parseFloat(rootCandidate.toFixed(2));
      }
      this.piecewiseBoundaries.sort((a, b) => a - b);
      this.showToast(`🎯 세로선들을 교점에 칼밀착 정렬했습니다!`);
    }

    const popover = document.getElementById('pwRegionPopover');
    if (popover) popover.style.display = 'none';
    this._openPwRegionIdx = null;

    this.syncPeriodicUI();
    this.updatePwDescBadge();
    this.render();
  }

  isInsidePiece(gIdx, x) {
    if (!this.usePiecewise || this.graphs.length < 1) {
      return true;
    }

    const g = this.graphs[gIdx];
    // [독립 관찰 그래프]: 직선 등 구간 분할 합성에 참여하지 않는 독립 레이어는 화면 전체에서 항상 가시(Visible)!
    if (g && g.isIndependent) {
      return true;
    }

    // [N-구간 다중 분할 엔진]
    if (this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
      let checkX = x;
      if (this.isPiecewisePeriodic && this.piecewiseBoundaries.length >= 2) {
        const b0 = this.piecewiseBoundaries[0];
        const bLast = this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1];
        const T = bLast - b0;
        if (T > 1e-4) {
          const k = Math.floor((x - b0) / T);
          let xBase = x - k * T;
          if (xBase >= bLast - 1e-6) xBase = b0;
          if (xBase < b0) xBase = b0;
          checkX = xBase;
        }
      }

      // checkX가 어느 구간(Region)에 속하는지 판정 (0 ~ N)
      let region = 0;
      const eps = 1e-5;
      for (let i = 0; i < this.piecewiseBoundaries.length; i++) {
        const b = this.piecewiseBoundaries[i];
        const isLeftInc = (this.piecewiseInclusions && this.piecewiseInclusions[i] === 'left');

        if (Math.abs(checkX - b) < eps) {
          if (this.isPiecewisePeriodic && (i === 0 || i === this.piecewiseBoundaries.length - 1)) {
            const seamLeftInc = (this.piecewiseInclusions && this.piecewiseInclusions[0] === 'left');
            region = seamLeftInc ? (this.piecewiseBoundaries.length - 1) : 1;
          } else if (isLeftInc) {
            region = i;
          } else {
            region = i + 1;
          }
          break;
        } else if (checkX > b) {
          region = i + 1;
        } else {
          break;
        }
      }

      const assignedGIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[region] !== undefined)
        ? this.piecewiseFuncMap[region]
        : (this.graphs.length > 0 ? (region % this.graphs.length) : -1);

      if (assignedGIdx === -1) {
        return false; // 해당 구간은 함수 없음 (비움)!
      }

      return assignedGIdx === gIdx;
    }

    // 레거시 폴백 (단일/사잇구간 호환)
    if (gIdx !== 0 && gIdx !== 1) return true;
    if (this.piecewiseMode === 'single') {
      const k = this.pwK;
      if (gIdx === 0) {
        return !this.pwSwap ? (x <= k) : (x > k);
      } else {
        return !this.pwSwap ? (x > k) : (x <= k);
      }
    } else {
      const a = Math.min(this.pwA, this.pwB);
      const b = Math.max(this.pwA, this.pwB);
      const insideDual = (x >= a && x <= b);
      if (gIdx === 0) {
        return !this.pwSwap ? insideDual : !insideDual;
      } else {
        return !this.pwSwap ? !insideDual : insideDual;
      }
    }
  }

  drawPiecewiseBoundaries(ctx, isExport = false) {
    if (!this.usePiecewise || this.graphs.length < 1) return;

    const isCleanOrSnap = Boolean(isExport || this.isCleanView || this._isRenderingGraphSnapshot);

    this.pwBoundaryBadges = [];
    this.pwRegionBadges = [];
    this.pwPeriodBracketBadge = null;

    const isLocked = Boolean(this.isPiecewiseLocked);
    const bColor = isLocked ? '#f59e0b' : '#a29bfe';
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.dark_charcoal;

    // 활성 그래프 교점 목록 (자석 스냅 시각 피드백용)
    const roots = (!isCleanOrSnap && this.graphs.length >= 2 && this.engine)
      ? this.engine.findIntersections(this.graphs[0], this.graphs[1], { xmin: -15, xmax: 15 }, null)
      : [];

    const boundaries = this.piecewiseBoundaries || [];
    const n = boundaries.length;

    // expCtx.scale(effScale, effScale)에서 이미 고해상도 배율이 일괄 반영되므로 이중 배율(exportScale) 제거
    const exportScale = 1;
    // 🌟 [대표님 피드백 반영]: 경계점 포함/배제 동그라미(●/○) 크기를 기존의 약 2/3 비율(dotR = 6.6px, 외경 ~7.4px)로 단정하게 최적화!
    const dotR = 6.6;
    const isTransparentExport = Boolean(isExport && this.exportTransparent);
    const openFillBg = (this.isMonochromeMode || curTheme.isLight)
      ? '#ffffff'
      : (curTheme.bg || '#1e1e2e');

    const drawEndpointCircle = (pt, graphObj, isFilled) => {
      if (!pt || !graphObj || pt.x < -30 || pt.x > this.screenWidth + 30 || pt.y < -30 || pt.y > this.screenHeight + 30) return;
      let strokeColor = this.isMonochromeMode ? '#000000' : (graphObj.color || '#2563eb');
      if (!this.isMonochromeMode && (curTheme.isLight || isTransparentExport) && (strokeColor.toLowerCase() === '#ffffff' || strokeColor.toLowerCase() === '#fff')) {
        strokeColor = '#222f3e';
      }
      ctx.save();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      if (isFilled) {
        // ● 색칠된 동그라미 (닫힌 점): 빈 동그라미(○)의 외경(dotR + 0.8)과 시각적 크기를 1:1로 완벽 일치!
        const filledR = (dotR + 0.8) * exportScale;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, filledR, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();
      } else {
        // ○ 빈 동그라미 (열린 점): 내부로 들어온 곡선 끝자락을 완벽히 가리고 선명한 링으로 렌더링
        const openR = dotR * exportScale;
        if (isTransparentExport) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(0.5, openR - 0.4), 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, openR, 0, Math.PI * 2);
          ctx.fillStyle = openFillBg;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, openR, 0, Math.PI * 2);
        ctx.lineWidth = 2.1 * exportScale;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawBoundaryPairCircles = (xMath, gL, yL, gR, yR, isLeftInc) => {
      if (gL && gR) {
        const sL = (!isNaN(yL) && isFinite(yL) && Math.abs(yL) < 150) ? this.mathToScreen(xMath, yL) : null;
        const sR = (!isNaN(yR) && isFinite(yR) && Math.abs(yR) < 150) ? this.mathToScreen(xMath, yR) : null;
        const isContinuous = sL && sR && Math.abs(sL.y - sR.y) < 3.5;

        if (isContinuous && sL) {
          drawEndpointCircle(sL, isLeftInc ? gL : gR, true);
        } else {
          if (isLeftInc) {
            drawEndpointCircle(sR, gR, false); // 우측 열린 점 ○
            drawEndpointCircle(sL, gL, true);  // 좌측 닫힌 점 ●
          } else {
            drawEndpointCircle(sL, gL, false); // 좌측 열린 점 ○
            drawEndpointCircle(sR, gR, true);  // 우측 닫힌 점 ●
          }
        }
      } else if (gL && !gR) {
        const sL = (!isNaN(yL) && isFinite(yL) && Math.abs(yL) < 150) ? this.mathToScreen(xMath, yL) : null;
        drawEndpointCircle(sL, gL, isLeftInc);
      } else if (!gL && gR) {
        const sR = (!isNaN(yR) && isFinite(yR) && Math.abs(yR) < 150) ? this.mathToScreen(xMath, yR) : null;
        drawEndpointCircle(sR, gR, !isLeftInc);
      }
    };

    // 1. 각 세로 분할선 및 정사각형 4분할 컨트롤 패드 (좌상: 🔒잠금, 우상: ✕삭제, 좌하: 좌포함, 우하: 우포함) 렌더링
    boundaries.forEach((bVal, bIdx) => {
      const sPos = this.mathToScreen(bVal, 0);
      const sx = sPos.x;

      const isSelected = (this.selectedPwBoundaryIdx === bIdx);
      ctx.save();

      // 편집 화면에서만 세로 분할 점선 및 상단 2x2 정사각형 컨트롤 패드 표시 (교재 캡처/스샷 시에는 깔끔하게 숨김)
      if (!isCleanOrSnap) {
        ctx.setLineDash(isLocked ? [3, 5] : [6, 4]);
        ctx.strokeStyle = isSelected ? '#00d2d3' : bColor;
        ctx.lineWidth = isSelected ? 2.2 : 1.6;
        ctx.shadowColor = isSelected ? 'rgba(0, 210, 211, 0.5)' : (isLocked ? 'rgba(245, 158, 11, 0.35)' : 'rgba(162, 155, 254, 0.4)');
        ctx.shadowBlur = isSelected ? 7 : 4;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, this.screenHeight);
        ctx.stroke();

        const isHit = roots.some(r => Math.abs(r.x - bVal) < 0.05);

        // 🌟 [대표님 핵심 기획: 컴팩트 2x2 정사각형 경계선 컨트롤 패드] 🌟
        // - 좌상단(Top-Left): 🔒/🔓 경계선 & 함수 개형 잠금 토글
        // - 우상단(Top-Right): ✕ 경계선 삭제 (잠금 상태에서도 삭제 가능!)
        // - 좌하단(Bottom-Left): 경계선 왼쪽 극한 점 포함(●)/배제(○)
        // - 우하단(Bottom-Right): 경계선 오른쪽 극한 점 포함(●)/배제(○)
        const padW = 42;
        const padH = 40;
        const halfW = padW / 2; // 21
        const halfH = padH / 2; // 20
        const padX = sx - halfW;
        const padY = 68; // 상단 곡선 툴바(.curve-context-bar)와 겹치지 않도록 넉넉히 낮추고 구간 함수 칩(center Y=88)과 수평 정렬!
        const midY = padY + halfH; // 102

        const isPeriodicSeam = (this.isPiecewisePeriodic && n >= 2 && (bIdx === 0 || bIdx === n - 1));
        const effectiveIncIdx = isPeriodicSeam ? 0 : bIdx;
        const isLeftInc = (this.piecewiseInclusions && this.piecewiseInclusions[effectiveIncIdx] === 'left');

        // 패드 외곽 배경
        ctx.setLineDash([]);
        ctx.fillStyle = curTheme.isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(18, 24, 38, 0.94)';
        ctx.strokeStyle = isLocked
          ? (curTheme.isLight ? 'rgba(217, 119, 6, 0.85)' : 'rgba(251, 191, 36, 0.85)')
          : (isSelected ? '#00d2d3' : (isHit ? 'rgba(254, 202, 87, 0.85)' : 'rgba(162, 155, 254, 0.72)'));
        ctx.lineWidth = (isSelected || isLocked) ? 1.7 : 1.2;
        ctx.shadowColor = isLocked ? 'rgba(245, 158, 11, 0.28)' : (isSelected ? 'rgba(0, 210, 211, 0.3)' : 'rgba(0, 0, 0, 0.18)');
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.roundRect(padX, padY, padW, padH, 8);
        ctx.fill();
        ctx.stroke();

        // 잠금 활성 시 좌상단 칸 은은한 골드 하이라이트
        if (isLocked) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(padX + 1, padY + 1, halfW - 1, halfH - 1, [7, 0, 0, 0]);
          ctx.fillStyle = curTheme.isLight ? 'rgba(254, 243, 199, 0.9)' : 'rgba(245, 158, 11, 0.22)';
          ctx.fill();
          ctx.restore();
        }

        // 십자(+) 내부 구분선 (가로줄 + 세로 경계선 일치)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = curTheme.isLight ? 'rgba(0, 0, 0, 0.11)' : 'rgba(255, 255, 255, 0.13)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX + 3, midY);
        ctx.lineTo(padX + padW - 3, midY);
        ctx.moveTo(sx, padY + 3);
        ctx.lineTo(sx, padY + padH - 3);
        ctx.stroke();

        // (1) 좌상단: 자물쇠 아이콘 (🔒 / 🔓)
        const lockCx = sx - halfW / 2; // sx - 10.5
        const lockCy = padY + halfH / 2; // 92
        const lockColor = isLocked
          ? (curTheme.isLight ? '#d97706' : '#fbbf24')
          : (curTheme.isLight ? '#64748b' : '#94a3b8');
        ctx.save();
        ctx.strokeStyle = lockColor;
        ctx.fillStyle = lockColor;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        // 자물쇠 몸통
        ctx.beginPath();
        ctx.roundRect(lockCx - 4.2, lockCy - 0.5, 8.4, 6.2, 1.5);
        if (isLocked) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
        // 자물쇠 고리 (Shackle)
        ctx.beginPath();
        if (isLocked) {
          ctx.arc(lockCx, lockCy - 0.5, 2.7, Math.PI, 0, false);
        } else {
          ctx.arc(lockCx - 1.2, lockCy - 1.2, 2.6, Math.PI, Math.PI * 1.85, false);
        }
        ctx.stroke();
        ctx.restore();

        // (2) 우상단: ✕ 삭제 버튼 (잠금 시에도 클릭 가능!)
        const delCx = sx + halfW / 2; // sx + 10.5
        const delCy = padY + halfH / 2; // 92
        const xHalf = 3.3;
        ctx.save();
        ctx.strokeStyle = curTheme.isLight ? '#475569' : '#cbd5e1';
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(delCx - xHalf, delCy - xHalf);
        ctx.lineTo(delCx + xHalf, delCy + xHalf);
        ctx.moveTo(delCx + xHalf, delCy - xHalf);
        ctx.lineTo(delCx - xHalf, delCy + xHalf);
        ctx.stroke();
        ctx.restore();

        // (3) 좌하단: 왼쪽 구간 포함 점 (● vs ○)
        const leftCx = sx - halfW / 2;
        const botCy = midY + halfH / 2; // 112
        const miniDotR = 3.6;
        ctx.save();
        if (isLocked) ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(leftCx, botCy, miniDotR, 0, Math.PI * 2);
        if (isLeftInc) {
          ctx.fillStyle = '#a29bfe';
          ctx.fill();
          ctx.strokeStyle = curTheme.isLight ? '#4c1d95' : '#ffffff';
          ctx.stroke();
        } else {
          ctx.fillStyle = curTheme.isLight ? '#f1f2f6' : '#1e272e';
          ctx.fill();
          ctx.strokeStyle = '#a29bfe';
          ctx.stroke();
        }

        // (4) 우하단: 오른쪽 구간 포함 점 (● vs ○)
        const rightCx = sx + halfW / 2;
        ctx.beginPath();
        ctx.arc(rightCx, botCy, miniDotR, 0, Math.PI * 2);
        if (!isLeftInc) {
          ctx.fillStyle = '#a29bfe';
          ctx.fill();
          ctx.strokeStyle = curTheme.isLight ? '#4c1d95' : '#ffffff';
          ctx.stroke();
        } else {
          ctx.fillStyle = curTheme.isLight ? '#f1f2f6' : '#1e272e';
          ctx.fill();
          ctx.strokeStyle = '#a29bfe';
          ctx.stroke();
        }
        ctx.restore();

        this.pwBoundaryBadges.push({
          bIdx,
          sx,
          bx: sx,
          by: padY,
          bw: halfW,
          bh: halfH,
          padRect: { x: padX, y: padY, w: padW, h: padH },
          lockRect: { x: padX, y: padY, w: halfW, h: halfH },
          delRect: { x: sx, y: padY, w: halfW, h: halfH },
          toggleRect: { x: padX, y: midY, w: padW, h: halfH },
          leftSlotRect: { x: padX, y: midY, w: halfW, h: halfH },
          rightSlotRect: { x: sx, y: midY, w: halfW, h: halfH }
        });
      }

      // 비주기 일반 모드일 때는 각 경계선(bVal)에서만 끝점 동그라미(●/○) 렌더링
      if (!(this.isPiecewisePeriodic && n >= 2)) {
        const isLeftInc = (this.piecewiseInclusions && this.piecewiseInclusions[bIdx] === 'left');
        const rIdxL = bIdx;
        const rIdxR = bIdx + 1;
        const gIdxL = (this.piecewiseFuncMap && this.piecewiseFuncMap[rIdxL] !== undefined)
          ? this.piecewiseFuncMap[rIdxL]
          : (this.graphs.length > 0 ? (rIdxL % this.graphs.length) : -1);
        const gIdxR = (this.piecewiseFuncMap && this.piecewiseFuncMap[rIdxR] !== undefined)
          ? this.piecewiseFuncMap[rIdxR]
          : (this.graphs.length > 0 ? (rIdxR % this.graphs.length) : -1);

        const gL = (gIdxL >= 0) ? this.graphs[gIdxL] : null;
        const gR = (gIdxR >= 0) ? this.graphs[gIdxR] : null;
        const yL = gL ? this.engine.evaluatePipeline(gL, bVal) : NaN;
        const yR = gR ? this.engine.evaluatePipeline(gR, bVal) : NaN;

        drawBoundaryPairCircles(bVal, gL, yL, gR, yR, isLeftInc);
      }

      ctx.restore();
    });

    // 1.2 [🔁 대표님 핵심 피드백 반영: 전구간 주기 반복(isPiecewisePeriodic) 시 화면의 모든 반복 주기마다 끝점 동그라미(●/○) 완벽 표시!]
    if (this.isPiecewisePeriodic && n >= 2) {
      const b0 = boundaries[0];
      const bLast = boundaries[n - 1];
      const T = bLast - b0;
      if (T > 1e-4) {
        const q = this.periodicStepY || 0;
        const mLeft = this.screenToMath(0, 0).x;
        const mRight = this.screenToMath(this.screenWidth, 0).x;
        const minMathX = Math.min(mLeft, mRight) - T;
        const maxMathX = Math.max(mLeft, mRight) + T;

        const kMin = Math.max(-40, Math.floor((minMathX - b0) / T));
        const kMax = Math.min(40, Math.ceil((maxMathX - b0) / T));

        // (A) 주기 경계선 (X_k = b0 + k * T): 왼쪽은 이전 주기(k-1)의 마지막 내부 구간(n-1) 끝점, 오른쪽은 현재 주기(k)의 첫 내부 구간(1) 시작점!
        const seamLeftInc = (this.piecewiseInclusions && this.piecewiseInclusions[0] === 'left');
        const gIdxFirst = (this.piecewiseFuncMap && this.piecewiseFuncMap[1] !== undefined)
          ? this.piecewiseFuncMap[1]
          : (this.graphs.length > 0 ? (1 % this.graphs.length) : -1);
        const gIdxLast = (this.piecewiseFuncMap && this.piecewiseFuncMap[n - 1] !== undefined)
          ? this.piecewiseFuncMap[n - 1]
          : (this.graphs.length > 0 ? ((n - 1) % this.graphs.length) : -1);

        const gFirst = (gIdxFirst >= 0) ? this.graphs[gIdxFirst] : null;
        const gLast = (gIdxLast >= 0) ? this.graphs[gIdxLast] : null;

        const baseYStart = gFirst ? this.engine.evaluatePipeline(gFirst, b0) : NaN;
        const baseYEnd = gLast ? this.engine.evaluatePipeline(gLast, bLast) : NaN;

        for (let k = kMin; k <= kMax; k++) {
          const seamX = b0 + k * T;
          const yL = baseYEnd + (k - 1) * q;
          const yR = baseYStart + k * q;
          drawBoundaryPairCircles(seamX, gLast, yL, gFirst, yR, seamLeftInc);

          // (B) 주기 내부 분할선 (b_i + k * T, 1 <= i <= n - 2)
          for (let i = 1; i < n - 1; i++) {
            const bi = boundaries[i];
            const innerX = bi + k * T;
            const innerLeftInc = (this.piecewiseInclusions && this.piecewiseInclusions[i] === 'left');
            const gIdxL = (this.piecewiseFuncMap && this.piecewiseFuncMap[i] !== undefined)
              ? this.piecewiseFuncMap[i]
              : (this.graphs.length > 0 ? (i % this.graphs.length) : -1);
            const gIdxR = (this.piecewiseFuncMap && this.piecewiseFuncMap[i + 1] !== undefined)
              ? this.piecewiseFuncMap[i + 1]
              : (this.graphs.length > 0 ? ((i + 1) % this.graphs.length) : -1);
            const gL = (gIdxL >= 0) ? this.graphs[gIdxL] : null;
            const gR = (gIdxR >= 0) ? this.graphs[gIdxR] : null;
            const yInnerL = gL ? (this.engine.evaluatePipeline(gL, bi) + k * q) : NaN;
            const yInnerR = gR ? (this.engine.evaluatePipeline(gR, bi) + k * q) : NaN;
            drawBoundaryPairCircles(innerX, gL, yInnerL, gR, yInnerR, innerLeftInc);
          }
        }
      }
    }

    // 1.5 [주기 컨트롤 박스는 좌측 구간 분할 서랍 메뉴(#panelPiecewise)로 분리되어 캔버스 상단 시야 100% 확보!]
    // (기존 자동화 테스트 호환을 위해 오프스크린 가상 좌표 y=-200으로 메타데이터만 유지)
    if (!isCleanOrSnap && n >= 2) {
      const pillX = 100, pillY = -200, pillW = 204, pillH = 22;
      const minusX = pillX + 128, plusX = pillX + 174, btnY = pillY + 3, btnW = 16, btnH = 16;
      this.pwPeriodBracketBadge = {
        pillX, pillY, pillW, pillH,
        toggleRect: { x: pillX, y: pillY, w: 94, h: pillH },
        minusRect: { x: minusX, y: btnY, w: btnW, h: btnH },
        valRect: { x: minusX + btnW, y: pillY, w: plusX - (minusX + btnW), h: pillH },
        plusRect: { x: plusX, y: btnY, w: btnW, h: btnH }
      };
    }

    // 2. 각 분할 영역 상단 함수 선택 칩 렌더링
    // - 양 끝 구간(rIdx===0, rIdx===n)은 화면 끝과 중점이 아닌 첫/마지막 경계선 바로 옆(±54px)에 집중 배치!
    // - 내부 구간(1 <= rIdx < n)은 두 경계선의 정중앙에 배치하되, 간격이 좁아지면(< 96px) 숨기지 않고 패드 바로 아래(chipY=114)로 살짝 내려서 표시!
    if (!isCleanOrSnap && n > 0) {
      let prevNarrowCx = -9999;
      let prevNarrowY = 114;
      for (let rIdx = 0; rIdx <= n; rIdx++) {
        let cx = 0;
        let chipY = 77;

        if (rIdx === 0) {
          const firstBx = this.mathToScreen(boundaries[0], 0).x;
          cx = firstBx - 54;
        } else if (rIdx === n) {
          const lastBx = this.mathToScreen(boundaries[n - 1], 0).x;
          cx = lastBx + 54;
        } else {
          const bLeftSx = this.mathToScreen(boundaries[rIdx - 1], 0).x;
          const bRightSx = this.mathToScreen(boundaries[rIdx], 0).x;
          const rawGap = bRightSx - bLeftSx;
          cx = (bLeftSx + bRightSx) / 2;
          if (rawGap < 96) {
            // 경계선 사이가 좁아졌을 때 알약이 사라지지 않고 2x2 패드(padY=68, padH=40 -> 하단 108) 바로 아래로 살짝 내려옴
            chipY = (Math.abs(cx - prevNarrowCx) < 44 && prevNarrowY === 114) ? 138 : 114;
            prevNarrowCx = cx;
            prevNarrowY = chipY;
          }
        }

        cx = Math.max(36, Math.min(this.screenWidth - 36, cx));

        const gIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[rIdx] !== undefined)
          ? this.piecewiseFuncMap[rIdx]
          : (this.graphs.length > 0 ? (rIdx % this.graphs.length) : -1);
        const curG = (gIdx >= 0) ? this.graphs[gIdx] : null;
        const gColor = curG ? curG.color : (gIdx === -1 ? '#747d8c' : '#a29bfe');
        const gLabel = curG ? `f${gIdx + 1}` : (gIdx === -1 ? `비움` : `f?`);

        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const textW = ctx.measureText(gLabel).width;
        const chipW = Math.max(40, textW + 24);
        const chipH = 22;
        const chipX = cx - chipW / 2;

        // 칩 배경 (글래스모피즘 알약)
        ctx.fillStyle = curTheme.isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(22, 30, 46, 0.94)';
        ctx.strokeStyle = this.hexToRgba(gColor, 0.7);
        ctx.lineWidth = 1.2;
        ctx.shadowColor = this.hexToRgba(gColor, 0.3);
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.roundRect(chipX, chipY, chipW, chipH, 11);
        ctx.fill();
        ctx.stroke();

        // 좌측 색상 도트
        ctx.shadowBlur = 0;
        ctx.fillStyle = gColor;
        ctx.beginPath();
        ctx.arc(chipX + 9, chipY + chipH / 2, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // 함수 이름 텍스트
        ctx.fillStyle = curTheme.isLight ? '#1e293b' : '#f1f5f9';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(gLabel, chipX + 16, chipY + chipH / 2);

        this.pwRegionBadges.push({
          regionIdx: rIdx,
          gIdx,
          label: gLabel,
          cx,
          chipX,
          chipY,
          chipW,
          chipH
        });
        ctx.restore();
      }
    }
  }

  setCanvasTheme(themeKey, showMsg = true) {
    if (!this.canvasThemes[themeKey]) return;
    if (this.isMonochromeMode) {
      this.isMonochromeMode = false;
      const btnMono = document.getElementById('btnMonochromeMode');
      if (btnMono) btnMono.classList.remove('active');
      document.body.classList.remove('mode-monochrome');
    }
    this.currentThemeKey = themeKey;

    document.querySelectorAll('.theme-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === themeKey);
    });

    const theme = this.canvasThemes[themeKey];
    if (theme.isLight) {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    if (document.documentElement) {
      document.documentElement.style.setProperty('--app-root-bg', theme.bg);
      document.documentElement.style.backgroundColor = theme.bg;
    }
    document.body.style.setProperty('--app-root-bg', theme.bg);
    document.body.style.backgroundColor = theme.bg;

    // 🌟 [컨테이너 배경 동기화]: 캔버스와 부모 컨테이너 배경색을 완전히 일치시켜 경계 깜빡임 0%화
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.style.backgroundColor = theme.bg;
    }

    // 🌟 [테마 연동 펜 & 곡선 컬러 동기화] 🌟
    this.colorPalette = (Array.isArray(this.autoColorSequence) && this.autoColorSequence.length > 0)
      ? [...this.autoColorSequence]
      : [...(this.defaultAutoColorSequence || ['#c74440', '#2d70b3', '#388c46', '#6042a6'])];
    this.updateInkPaletteUI();

    if (typeof this.renderPipGraphCard === 'function') {
      if (this._hasPrimaryGraphCard && this.graphCardData) {
        this.renderPipGraphCard('primary');
        this.bakePipGraphCardToImg('primary');
      }
      if (Array.isArray(this.extraGraphCards)) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el) {
            this.renderPipGraphCard(c);
            this.bakePipGraphCardToImg(c);
          }
        });
      }
    }

    this._inkBakeDirty = true;
    this.requestRender();
    if (typeof this.scheduleSaveUserPreferences === 'function') {
      this.scheduleSaveUserPreferences();
    }
    if (showMsg) {
      this.showToast(`🎨 캔버스 테마: ${theme.name} 적용 완료!`);
    }
  }

  initBoardPaperControls() {
    document.querySelectorAll('.board-paper-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.paper === this.boardPaperType);
      btn.onclick = (e) => {
        e.stopPropagation();
        const paper = e.currentTarget.dataset.paper;
        if (paper) this.setBoardPaperType(paper);
      };
    });
  }

  setBoardPaperType(paperType, showMsg = true) {
    if (!['blank', 'grid', 'lined', 'dot'].includes(paperType)) return;
    this.boardPaperType = paperType;
    try {
      localStorage.setItem('graphly_board_paper_v1', paperType);
    } catch (err) { }

    document.querySelectorAll('.board-paper-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.paper === paperType);
    });

    this._hasSceneFreeze = false;
    this.render();
    if (typeof this.scheduleSaveUserPreferences === 'function') {
      this.scheduleSaveUserPreferences();
    }
    if (showMsg) {
      const names = { blank: '무지', grid: '모눈 노트', lined: '가로줄 노트', dot: '도트 노트' };
      this.showToast(`📋 캔버스 배경 속지: ${names[paperType] || paperType} 적용!`);
    }
  }

  drawBoardPaperBackground(ctx, width, height, curTheme) {
    if (!this.boardPaperType || this.boardPaperType === 'blank') return;

    const isLight = Boolean((curTheme && curTheme.isLight) || this.isMonochromeMode);
    const bz = this.boardZoom || 1.0;
    const baseStep = (this.boardPaperType === 'lined') ? 40 : 34;
    let step = baseStep * bz;
    while (step < 18) step *= 2;
    while (step > 76) step /= 2;

    const origin = this.boardToScreen(0, 0);
    const startX = ((origin.x % step) + step) % step;
    const startY = ((origin.y % step) + step) % step;

    ctx.save();
    if (this.boardPaperType === 'grid') {
      ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.25)' : 'rgba(255, 255, 255, 0.075)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x <= width; x += step) {
        const rx = Math.round(x) + 0.5;
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx, height);
      }
      for (let y = startY; y <= height; y += step) {
        const ry = Math.round(y) + 0.5;
        ctx.moveTo(0, ry);
        ctx.lineTo(width, ry);
      }
      ctx.stroke();
    } else if (this.boardPaperType === 'lined') {
      ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.32)' : 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = startY; y <= height; y += step) {
        const ry = Math.round(y) + 0.5;
        ctx.moveTo(0, ry);
        ctx.lineTo(width, ry);
      }
      ctx.stroke();
    } else if (this.boardPaperType === 'dot') {
      ctx.fillStyle = isLight ? 'rgba(100, 116, 139, 0.34)' : 'rgba(255, 255, 255, 0.18)';
      const r = 1.3;
      ctx.beginPath();
      for (let x = startX; x <= width; x += step) {
        for (let y = startY; y <= height; y += step) {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }
    ctx.restore();
  }

  // 🌟 [테마별 필기 잉크 팔레트 동적 동기화] 🌟
  updateInkPaletteUI() {
    const curTheme = this.canvasThemes[this.currentThemeKey] || this.canvasThemes.white_paper;
    const isLight = curTheme.isLight;
    const palette = isLight ? this.lightInkPalette : this.darkInkPalette;
    const dots = document.querySelectorAll('.ink-color-dot');

    // 색상이 현재 팔레트에 없는 경우 (예: 테마 전환 시 화이트 -> 차콜블랙 자동 전환)
    const prevColor = (this.currentInkColor || '').toLowerCase();
    let newColorMatch = false;

    dots.forEach((dot, idx) => {
      if (idx < palette.length) {
        const c = palette[idx];
        dot.dataset.color = c;
        dot.style.background = c;
        if (c.toLowerCase() === '#ffffff') {
          dot.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.2)';
        } else {
          dot.style.boxShadow = 'none';
        }
        if (c.toLowerCase() === prevColor) {
          newColorMatch = true;
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      }
    });

    if (!newColorMatch && palette.length > 0) {
      // 기본 0번 색상(화이트 테마: 차콜 블랙, 다크 테마: 분필 화이트)으로 자동 선택
      this.currentInkColor = palette[0];
      if (dots[0]) dots[0].classList.add('active');
    }

    // 알약 리모컨 5색 팔레트 도트도 테마(라이트/다크)에 맞춰 100% 동기화
    const pillDots = document.querySelectorAll('.pill-color-dot');
    const curLower = (this.currentInkColor || '').toLowerCase();
    pillDots.forEach((dot, idx) => {
      if (idx < palette.length) {
        const c = palette[idx];
        dot.dataset.color = c;
        dot.style.background = c;
        dot.style.boxShadow = (c.toLowerCase() === '#ffffff') ? 'inset 0 0 0 1px rgba(0,0,0,0.25)' : '';
        dot.classList.toggle('active', c.toLowerCase() === curLower);
      }
    });

    // 올가미 플로팅 바 5색 팔레트 도트도 테마에 맞춰 동기화
    const lassoDots = document.querySelectorAll('.lasso-color-dot');
    lassoDots.forEach((dot, idx) => {
      if (idx < palette.length) {
        const c = palette[idx];
        dot.dataset.color = c;
        dot.style.background = c;
        dot.style.boxShadow = (c.toLowerCase() === '#ffffff') ? 'inset 0 0 0 1px rgba(0,0,0,0.25)' : '';
      }
    });
  }

  // --- [🔗 공유 모달 & 학생용 모드 & QR 코드 생성 엔진] ---
  // --- [🔀 세계 최초 N축 합성함수 4-분할 스튜디오 모달 & 1:1 직결 레이저 엔진] ---
  initNAxisStudioModal() {
    const modal = document.getElementById('modalNAxisStudio');
    const btnRail = document.getElementById('btnRailNAxis');
    const btnQuick = document.getElementById('btnQuickNAxis');
    const btnClose = document.getElementById('btnCloseNAxisStudio');
    const btnArchive = document.getElementById('btnNAxisArchiveToBoard');
    const canvas = document.getElementById('nAxisStudioCanvas');
    if (!modal || !canvas) return;

    const ctx = canvas.getContext('2d');
    const midX = 560;
    const midY = 340;

    let tMin = -3.8, tMax = 3.8;
    let yMin = -4.5, yMax = 4.5;
    let xMin = -3.2, xMax = 3.2;

    const inputG = document.getElementById('inputNAxisG');
    const inputF = document.getElementById('inputNAxisF');
    const sliderX = document.getElementById('sliderNAxisX');
    const lblCurX = document.getElementById('lblNAxisCurX');
    const dispX = document.getElementById('dispNAxisX');
    const dispT = document.getElementById('dispNAxisT');
    const dispY = document.getElementById('dispNAxisY');
    const btnAutoPlay = document.getElementById('btnNAxisAutoPlay');

    // 🌟 [만능 방탄 수식 컴파일러]:
    // 1) 겉함수에 x를 치든 t를 치든 둘 다 자동 인식 (x, t 동시 바인딩)
    // 2) 중첩 절댓값(||x|-1|), 괄호 생략(2sinx, lnx, 루트x), 지수 생략(x2, t3, ²·³·⁴), 암묵적 곱셈(2e^x, x(x-1)) 100% 지원
    // 3) 정의역 이탈(ln(-1), sqrt(-1), 1/0) 시 가짜 0이 아닌 NaN을 반환하여 그래프 왜곡 원천 차단!
    function compileMathExpr(exprStr, varName) {
      if (!exprStr || typeof exprStr !== 'string') return () => 0;
      let s = exprStr.trim();
      if (!s) return () => 0;

      // 유니코드/한글 수학 기호 정규화
      s = s.replace(/[−–—]/g, '-')
        .replace(/[×·]/g, '*')
        .replace(/÷/g, '/')
        .replace(/²/g, '^2')
        .replace(/³/g, '^3')
        .replace(/⁴/g, '^4')
        .replace(/루트|√/g, 'sqrt')
        .replace(/파이|π/g, 'pi');

      // 중첩 절댓값 |...| -> abs(...) 반복 변환
      let guard = 0;
      while (/\|[^|]+\|/.test(s) && guard < 10) {
        s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
        guard++;
      }

      s = s.replace(/\s+/g, '');

      // 함수 뒤 괄호 생략 지원: 2sin2x -> 2sin(2x), sinx -> sin(x), lnx -> ln(x), sqrtx -> sqrt(x)
      s = s.replace(/(asin|acos|atan|sqrt|floor|ceil|sin|cos|tan|abs|exp|ln|log)(-?\d*\.?\d*[xt])(?![a-zA-Z0-9_\(])/gi, '$1($2)');

      // 약식 거듭제곱: x2 -> x^2, t3 -> t^3, )2 -> )^2
      s = s.replace(/([xt\)])(\d+)(?![\d\.])/gi, '$1^$2');

      // 상용구 log(x)는 기존 N축 동작과 동일하게 상용로그(log10)로 매핑, 독립 변수 t는 x로 통합 바인딩
      s = s.replace(/(?<![a-zA-Z])log(?=\()/gi, 'log10');
      s = s.replace(/(?<![a-zA-Z])t(?![a-zA-Z])/g, 'x');

      // 🛡️ SafeMathCompiler 스택 평가 엔진 사용 (eval / new Function 0% — 동적 코드 실행 원천 차단)
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

    let compiledG = compileMathExpr(inputG ? inputG.value : '2.5 * cos(x)', 'x');
    let compiledF = compileMathExpr(inputF ? inputF.value : 't^3 - 3*t', 't');
    let criticalSnapPoints = []; // [{ x, label }]
    let activeSnapLabel = null;

    function evalG(x) { return compiledG(x); }
    function evalF(t) { return isFinite(t) ? compiledF(t) : NaN; }
    function evalComp(x) {
      const t = evalG(x);
      return isFinite(t) ? evalF(t) : NaN;
    }

    function toScreenT(t) {
      const margin = 50;
      const w = midX - margin * 2;
      return margin + ((t - tMin) / (tMax - tMin)) * w;
    }

    function toScreenY(y) {
      const pad = 38;
      const h = midY - pad * 2;
      return pad + ((yMax - y) / (yMax - yMin)) * h;
    }

    function toScreenLeftX(x) {
      const pad = 38;
      const h = (canvas.height - midY) - pad * 2;
      return midY + pad + ((x - xMin) / (xMax - xMin)) * h;
    }

    function toScreenRightX(x) {
      const pad = 50;
      const startX = midX + pad;
      const w = (canvas.width - midX) - pad * 2;
      return startX + ((x - xMin) / (xMax - xMin)) * w;
    }

    // 🌟 [특징점(속함수 극점 · 겉함수 극점 도달 · 원점) 자동 역산 및 자석 스냅 엔진] 🌟
    function computeCriticalSnapPoints() {
      const pts = [{ x: 0, label: 'x = 0' }];
      const N = 300;
      const dx = (xMax - xMin) / N;

      // 1) 겉함수 f(t)의 극점/첨점 t* 탐색
      const fCritT = [0];
      const dt = (tMax - tMin) / N;
      for (let i = 1; i < N; i++) {
        const t0 = tMin + (i - 1) * dt;
        const t1 = tMin + i * dt;
        const t2 = tMin + (i + 1) * dt;
        const y0 = evalF(t0), y1 = evalF(t1), y2 = evalF(t2);
        if (!isFinite(y0) || !isFinite(y1) || !isFinite(y2)) continue;
        const d1 = y1 - y0, d2 = y2 - y1;
        if ((d1 > 1e-5 && d2 < -1e-5) || (d1 < -1e-5 && d2 > 1e-5)) {
          fCritT.push(Number(t1.toFixed(2)));
        }
      }

      // 2) 속함수 g(x)의 극점/첨점 및 g(x) = t* 도달 지점 탐색
      for (let i = 1; i < N; i++) {
        const x0 = xMin + (i - 1) * dx;
        const x1 = xMin + i * dx;
        const x2 = xMin + (i + 1) * dx;
        const t0 = evalG(x0), t1 = evalG(x1), t2 = evalG(x2);
        if (!isFinite(t0) || !isFinite(t1) || !isFinite(t2)) continue;
        const d1 = t1 - t0, d2 = t2 - t1;
        if ((d1 > 1e-5 && d2 < -1e-5) || (d1 < -1e-5 && d2 > 1e-5)) {
          pts.push({ x: Number(x1.toFixed(2)), label: '속함수 극점' });
        }
        for (const tc of fCritT) {
          if ((t0 - tc) * (t1 - tc) <= 0 && Math.abs(t1 - t0) < 2.0) {
            const ratio = Math.abs(t1 - t0) > 1e-7 ? Math.abs(tc - t0) / Math.abs(t1 - t0) : 0.5;
            const xc = x0 + ratio * dx;
            pts.push({ x: Number(xc.toFixed(2)), label: tc === 0 ? 'g(x) = 0' : '겉함수 극점 도달' });
          }
        }
      }

      // 중복 제거
      const unique = [];
      for (const p of pts) {
        if (p.x < xMin || p.x > xMax) continue;
        if (!unique.some(u => Math.abs(u.x - p.x) < (xMax - xMin) * 0.025)) {
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

    // 🌟 [점근선·정의역 이탈에도 절대 찌그러지지 않는 스마트 치역 자동 맞춤] 🌟
    function autoFitRange() {
      const n = 160;
      const tVals = [];
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        const t = evalG(x);
        if (isFinite(t) && Math.abs(t) < 50) tVals.push(t);
      }
      if (tVals.length > 0) {
        tVals.sort((a, b) => a - b);
        const minT = tVals[Math.floor(tVals.length * 0.04)];
        const maxT = tVals[Math.min(tVals.length - 1, Math.ceil(tVals.length * 0.96))];
        const spanT = Math.max(1.2, maxT - minT);
        tMin = Math.floor((minT - spanT * 0.22) * 2) / 2;
        tMax = Math.ceil((maxT + spanT * 0.22) * 2) / 2;
        if (tMin > -0.5) tMin = -1.0;
        if (tMax < 0.5) tMax = 1.0;
      } else {
        tMin = -3.8; tMax = 3.8;
      }

      const yVals = [];
      for (let i = 0; i <= n; i++) {
        const t = tMin + (i / n) * (tMax - tMin);
        const y = evalF(t);
        if (isFinite(y) && Math.abs(y) < 60) yVals.push(y);
      }
      for (let i = 0; i <= n; i++) {
        const x = xMin + (i / n) * (xMax - xMin);
        const y = evalComp(x);
        if (isFinite(y) && Math.abs(y) < 60) yVals.push(y);
      }
      if (yVals.length > 0) {
        yVals.sort((a, b) => a - b);
        const minY = yVals[Math.floor(yVals.length * 0.04)];
        const maxY = yVals[Math.min(yVals.length - 1, Math.ceil(yVals.length * 0.96))];
        const spanY = Math.max(1.2, maxY - minY);
        yMin = Math.floor((minY - spanY * 0.20) * 2) / 2;
        yMax = Math.ceil((maxY + spanY * 0.20) * 2) / 2;
        if (yMin > -0.5) yMin = -1.0;
        if (yMax < 0.5) yMax = 1.0;
      } else {
        yMin = -4.5; yMax = 4.5;
      }
      computeCriticalSnapPoints();
    }

    function updateFormulas() {
      if (inputG) compiledG = compileMathExpr(inputG.value, 'x');
      if (inputF) compiledF = compileMathExpr(inputF.value, 't');
      autoFitRange();
      renderStudio();
    }

    let currentX = 0.50;
    let isAutoPlaying = false;
    let playSpeed = 1.0;
    let autoPlayAnimId = null;

    function drawSafeCurve(points, maxJumpPx = 260) {
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

    function renderStudio(forArchiveExport = false) {
      if (!forArchiveExport && !modal.classList.contains('show')) return;

      const isLight = document.body.classList.contains('theme-light');
      const pal = isLight ? {
        bg: '#ffffff',
        quadBg3: '#faf5ff',
        divider: '#cbd5e1',
        axis: 'rgba(30, 41, 59, 0.45)',
        outerColor: '#dc2626',     // ① 겉함수 f(t): 크림슨 레드
        innerColor: '#2563eb',     // ② 속함수 g(x): 로열 블루
        compColor: '#7c3aed',      // ③ 합성함수 f(g(x)): 딥 바이올렛
        compGhost: 'rgba(124, 58, 237, 0.22)',
        laserV: '#d97706',         // 수직 레이저 (t 매개): 골든 앰버
        laserH: '#059669',         // 수평 레이저 (y 전달): 에메랄드
        textMain: '#0f172a',
        textMuted: '#475569',
        dotStroke: '#ffffff'
      } : {
        bg: '#0b1520',
        quadBg3: 'rgba(0, 210, 211, 0.03)',
        divider: 'rgba(0, 210, 211, 0.28)',
        axis: 'rgba(255, 255, 255, 0.42)',
        outerColor: '#ff6b6b',
        innerColor: '#54a0ff',
        compColor: '#00d2d3',
        compGhost: 'rgba(0, 210, 211, 0.24)',
        laserV: '#feca57',
        laserH: '#00d2d3',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        dotStroke: '#0f172a'
      };

      // 스탯 카드 컬러도 테마에 맞춰 동기화
      if (dispX) dispX.style.color = pal.innerColor;
      if (dispT) dispT.style.color = pal.laserV;
      if (dispY) dispY.style.color = pal.compColor;

      ctx.save();
      ctx.fillStyle = pal.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 우상단 합성함수 영역 은은한 배경 하이라이트
      ctx.fillStyle = pal.quadBg3;
      ctx.fillRect(midX, 0, canvas.width - midX, midY);

      // 4분할 십자 경계선
      ctx.strokeStyle = pal.divider;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(midX, 12);
      ctx.lineTo(midX, canvas.height - 12);
      ctx.moveTo(12, midY);
      ctx.lineTo(canvas.width - 12, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      const topOriginY = Math.max(38, Math.min(midY - 30, toScreenY(0)));
      const topOriginX = Math.max(45, Math.min(midX - 35, toScreenT(0)));
      const steps = 320;

      // ====================================================================
      // 1. 좌상단 (Quadrant 1): 겉함수 y = f(t) (클리핑 적용)
      // ====================================================================
      ctx.save();
      ctx.beginPath();
      ctx.rect(8, 8, midX - 16, midY - 16);
      ctx.clip();

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toScreenT(tMin), topOriginY);
      ctx.lineTo(toScreenT(tMax) + 12, topOriginY);
      ctx.moveTo(topOriginX, toScreenY(yMin));
      ctx.lineTo(topOriginX, toScreenY(yMax) - 10);
      ctx.stroke();

      const ptsF = [];
      for (let i = 0; i <= steps; i++) {
        const t = tMin + (i / steps) * (tMax - tMin);
        const y = evalF(t);
        ptsF.push(isFinite(y) ? { sx: toScreenT(t), sy: toScreenY(y) } : null);
      }
      ctx.strokeStyle = pal.outerColor;
      ctx.lineWidth = 2.6;
      drawSafeCurve(ptsF);
      ctx.restore();

      ctx.font = 'bold 12.5px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.outerColor;
      ctx.fillText(`① 겉함수: y = f(t) = ${inputF ? inputF.value : ''}`, 22, 24);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = pal.laserV;
      ctx.fillText('t축', toScreenT(tMax) - 20, topOriginY + 15);
      ctx.fillStyle = pal.outerColor;
      ctx.fillText('y', topOriginX + 7, 46);

      // ====================================================================
      // 2. 좌하단 (Quadrant 2): 속함수 t = g(x) (90도 회전, 클리핑 적용)
      // ====================================================================
      const botOriginY = Math.max(midY + 35, Math.min(canvas.height - 30, toScreenLeftX(0)));
      const botOriginX = topOriginX;

      ctx.save();
      ctx.beginPath();
      ctx.rect(8, midY + 8, midX - 16, canvas.height - midY - 16);
      ctx.clip();

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toScreenT(tMin), botOriginY);
      ctx.lineTo(toScreenT(tMax) + 12, botOriginY);
      ctx.moveTo(botOriginX, toScreenLeftX(xMin));
      ctx.lineTo(botOriginX, toScreenLeftX(xMax) + 12);
      ctx.stroke();

      const ptsG = [];
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const t = evalG(x);
        ptsG.push(isFinite(t) ? { sx: toScreenT(t), sy: toScreenLeftX(x) } : null);
      }
      ctx.strokeStyle = pal.innerColor;
      ctx.lineWidth = 2.6;
      drawSafeCurve(ptsG);
      ctx.restore();

      ctx.font = 'bold 12.5px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.innerColor;
      ctx.fillText(`② 속함수 (90° 회전): t = g(x) = ${inputG ? inputG.value : ''}`, 22, midY + 22);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = pal.laserV;
      ctx.fillText('t = g(x)', toScreenT(tMax) - 42, botOriginY + 15);
      ctx.fillStyle = pal.innerColor;
      ctx.fillText('x (아래로 증가 ↓)', botOriginX + 6, canvas.height - 12);

      // ====================================================================
      // 3. 우상단 (Quadrant 3): 최종 합성함수 y = f(g(x)) (실시간 궤적 그리기 지원!)
      // ====================================================================
      const rOriginX = Math.max(midX + 40, Math.min(canvas.width - 35, toScreenRightX(0)));
      const rOriginY = topOriginY;

      ctx.save();
      ctx.beginPath();
      ctx.rect(midX + 8, 8, canvas.width - midX - 16, midY - 16);
      ctx.clip();

      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(toScreenRightX(xMin), rOriginY);
      ctx.lineTo(toScreenRightX(xMax) + 12, rOriginY);
      ctx.moveTo(rOriginX, toScreenY(yMin));
      ctx.lineTo(rOriginX, toScreenY(yMax) - 10);
      ctx.stroke();

      // (3-A) 전체 합성함수 개형은 은은한 가이드선으로 배경에 표시
      const ptsCompFull = [];
      const ptsCompActive = [];
      for (let i = 0; i <= steps; i++) {
        const x = xMin + (i / steps) * (xMax - xMin);
        const y = evalComp(x);
        const pt = isFinite(y) ? { sx: toScreenRightX(x), sy: toScreenY(y) } : null;
        ptsCompFull.push(pt);
        if (x <= currentX + 1e-4) {
          ptsCompActive.push(pt);
        }
      }
      ctx.strokeStyle = pal.compGhost;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 4]);
      drawSafeCurve(ptsCompFull);
      ctx.setLineDash([]);

      // (3-B) xMin ~ currentX까지 레이저가 지나간 궤적을 진한 실선으로 실시간 드로잉!
      ctx.strokeStyle = pal.compColor;
      ctx.lineWidth = 3.2;
      drawSafeCurve(ptsCompActive);
      ctx.restore();

      ctx.font = 'bold 12.5px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = pal.compColor;
      ctx.fillText('③ 최종 완성: y = f(g(x))', midX + 22, 24);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = pal.innerColor;
      ctx.fillText('x축', toScreenRightX(xMax) - 18, rOriginY + 15);
      ctx.fillStyle = pal.compColor;
      ctx.fillText('y', rOriginX + 7, 46);

      // ====================================================================
      // 4. L자 관통 레이저 (pt1 -> pt2 -> pt3)
      // ====================================================================
      const tVal = evalG(currentX);
      const yVal = evalF(tVal);

      if (isFinite(tVal) && isFinite(yVal)) {
        const pt1X = toScreenT(tVal);
        const pt1Y = toScreenLeftX(currentX);
        const pt2X = toScreenT(tVal);
        const pt2Y = toScreenY(yVal);
        const pt3X = toScreenRightX(currentX);
        const pt3Y = toScreenY(yVal);

        ctx.save();
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 4]);

        // 수직 레이저 (좌하 속함수 -> 좌상 겉함수)
        ctx.strokeStyle = pal.laserV;
        ctx.beginPath();
        ctx.moveTo(pt1X, pt1Y);
        ctx.lineTo(pt2X, pt2Y);
        ctx.stroke();

        // 수직 화살촉
        ctx.setLineDash([]);
        ctx.fillStyle = pal.laserV;
        ctx.beginPath();
        ctx.moveTo(pt2X, midY - 12);
        ctx.lineTo(pt2X - 5.5, midY - 2);
        ctx.lineTo(pt2X + 5.5, midY - 2);
        ctx.fill();

        // 수평 레이저 (좌상 겉함수 -> 우상 합성함수)
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = pal.laserH;
        ctx.beginPath();
        ctx.moveTo(pt2X, pt2Y);
        ctx.lineTo(pt3X, pt3Y);
        ctx.stroke();

        // 수평 화살촉
        ctx.setLineDash([]);
        ctx.fillStyle = pal.laserH;
        ctx.beginPath();
        ctx.moveTo(midX + 12, pt2Y);
        ctx.lineTo(midX + 2, pt2Y - 5.5);
        ctx.lineTo(midX + 2, pt2Y + 5.5);
        ctx.fill();

        // 우상단 합성함수 x 위치 수직 보조선
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = isLight ? 'rgba(37, 99, 235, 0.35)' : 'rgba(84, 160, 255, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pt3X, rOriginY);
        ctx.lineTo(pt3X, pt3Y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 포인트 3개 (pt1: 속함수, pt2: 겉함수, pt3: 합성함수)
        const drawDot = (x, y, r, fill) => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = pal.dotStroke;
          ctx.stroke();
        };

        drawDot(pt1X, pt1Y, 6.5, pal.innerColor);
        drawDot(pt2X, pt2Y, 6.5, pal.outerColor);
        drawDot(pt3X, pt3Y, 8.0, pal.compColor);

        // 특징점 자석 스냅 배지 또는 현재 좌표 배지 표시
        const badgeText = activeSnapLabel
          ? `⚡ ${activeSnapLabel} (x=${currentX.toFixed(2)}, y=${yVal.toFixed(2)})`
          : `(${currentX.toFixed(2)}, ${yVal.toFixed(2)})`;
        ctx.font = 'bold 11px Pretendard, system-ui, sans-serif';
        const bw = ctx.measureText(badgeText).width + 16;
        const bh = 22;
        const bx = Math.max(midX + 12, Math.min(canvas.width - bw - 12, pt3X - bw / 2));
        const by = Math.max(32, pt3Y - 30);
        ctx.fillStyle = activeSnapLabel ? (isLight ? '#fef3c7' : '#451a03') : (isLight ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.92)');
        ctx.strokeStyle = activeSnapLabel ? '#d97706' : pal.compColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 11);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = activeSnapLabel ? (isLight ? '#b45309' : '#fde68a') : pal.textMain;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + bw / 2, by + bh / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        ctx.restore();
      }

      // ====================================================================
      // 5. 우하단 (Quadrant 4): 칠판 보관 카드 내보내기 시 깔끔한 수식·상태 요약 카드 렌더링
      // ====================================================================
      if (forArchiveExport) {
        const qx = midX + 28, qy = midY + 28, qw = canvas.width - midX - 56, qh = canvas.height - midY - 56;
        ctx.fillStyle = isLight ? '#f8fafc' : '#0f172a';
        ctx.strokeStyle = pal.divider;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(qx, qy, qw, qh, 14);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 15px Pretendard, system-ui, sans-serif';
        ctx.fillStyle = pal.textMain;
        ctx.fillText('📌 N축 합성함수 핵심 요약', qx + 22, qy + 36);

        ctx.font = 'bold 13.5px monospace';
        ctx.fillStyle = pal.innerColor;
        ctx.fillText(`• 속함수 g(x) = ${inputG ? inputG.value : ''}`, qx + 22, qy + 76);
        ctx.fillStyle = pal.outerColor;
        ctx.fillText(`• 겉함수 f(t) = ${inputF ? inputF.value : ''}`, qx + 22, qy + 110);
        ctx.fillStyle = pal.compColor;
        ctx.fillText(`• 합성함수 y = f(g(x))`, qx + 22, qy + 144);

        if (isFinite(tVal) && isFinite(yVal)) {
          ctx.font = 'bold 13px Pretendard, system-ui, sans-serif';
          ctx.fillStyle = pal.textMuted;
          ctx.fillText(`현재 추적 지점:  x = ${currentX.toFixed(2)}  ➔  t = ${tVal.toFixed(2)}  ➔  y = ${yVal.toFixed(2)}`, qx + 22, qy + 190);
        }
      }

      ctx.restore();

      const snapSuffix = activeSnapLabel ? ` (${activeSnapLabel})` : '';
      if (lblCurX) lblCurX.textContent = `x = ${currentX.toFixed(2)}${snapSuffix}`;
      if (dispX) dispX.textContent = currentX.toFixed(2);
      if (dispT) dispT.textContent = isFinite(tVal) ? tVal.toFixed(2) : '-';
      if (dispY) dispY.textContent = isFinite(yVal) ? yVal.toFixed(2) : '-';
    }

    function loopAutoPlay() {
      if (!isAutoPlaying) return;
      const span = (xMax - xMin);
      const baseStep = span / 420;
      currentX += baseStep * playSpeed;
      activeSnapLabel = null;
      if (currentX > xMax) currentX = xMin;
      if (sliderX) sliderX.value = currentX;
      renderStudio();
      autoPlayAnimId = requestAnimationFrame(loopAutoPlay);
    }

    const getNAxisStudioState = () => ({
      exprG: inputG ? inputG.value : '2.5 * cos(x)',
      exprF: inputF ? inputF.value : 't^3 - 3*t',
      currentX: typeof currentX === 'number' ? currentX : 0.5,
      xMin: typeof xMin === 'number' ? xMin : -3.2,
      xMax: typeof xMax === 'number' ? xMax : 3.2,
      tMin: typeof tMin === 'number' ? tMin : -3.8,
      tMax: typeof tMax === 'number' ? tMax : 3.8,
      yMin: typeof yMin === 'number' ? yMin : -4.5,
      yMax: typeof yMax === 'number' ? yMax : 4.5,
      playSpeed: typeof playSpeed === 'number' ? playSpeed : 1.0,
      activeSnapLabel: activeSnapLabel || null
    });

    const applyNAxisStudioState = (st) => {
      if (!st || typeof st !== 'object') return false;
      if (inputG && typeof st.exprG === 'string') inputG.value = st.exprG;
      if (inputF && typeof st.exprF === 'string') inputF.value = st.exprF;
      if (typeof st.xMin === 'number' && typeof st.xMax === 'number' && st.xMax > st.xMin) {
        xMin = st.xMin;
        xMax = st.xMax;
      }
      if (sliderX) {
        sliderX.min = xMin;
        sliderX.max = xMax;
      }
      if (inputG) compiledG = compileMathExpr(inputG.value, 'x');
      if (inputF) compiledF = compileMathExpr(inputF.value, 't');
      if (typeof st.tMin === 'number' && typeof st.tMax === 'number' && st.tMax > st.tMin &&
          typeof st.yMin === 'number' && typeof st.yMax === 'number' && st.yMax > st.yMin) {
        tMin = st.tMin;
        tMax = st.tMax;
        yMin = st.yMin;
        yMax = st.yMax;
        computeCriticalSnapPoints();
      } else {
        autoFitRange();
      }
      if (typeof st.currentX === 'number' && isFinite(st.currentX)) {
        currentX = Math.max(xMin, Math.min(xMax, st.currentX));
      }
      if (sliderX) {
        sliderX.value = currentX;
      }
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
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }
      isAutoPlaying = false;
      if (autoPlayAnimId) cancelAnimationFrame(autoPlayAnimId);
      if (btnAutoPlay) btnAutoPlay.textContent = '▶ 자동 순항';
      this.isNAxisStudioOpen = true;
      modal.style.display = 'flex';
      modal.classList.add('show');
      const isValidStateObj = Boolean(
        studioState &&
        typeof studioState === 'object' &&
        !(typeof Event !== 'undefined' && studioState instanceof Event) &&
        (typeof studioState.exprG === 'string' || typeof studioState.exprF === 'string' || typeof studioState.currentX === 'number')
      );
      if (isValidStateObj) {
        const tc = document.getElementById('tabContentNAxisCustom');
        const tp = document.getElementById('tabContentNAxisPresets');
        const bc = document.getElementById('tabBtnNAxisCustom');
        const bp = document.getElementById('tabBtnNAxisPresets');
        if (tc) tc.style.display = 'flex';
        if (tp) tp.style.display = 'none';
        if (bc) bc.classList.add('active');
        if (bp) bp.classList.remove('active');
        applyNAxisStudioState(studioState);
      } else {
        autoFitRange();
      }
      renderStudio();
    };

    const closeModal = () => {
      isAutoPlaying = false;
      this.isNAxisStudioOpen = false;
      if (autoPlayAnimId) cancelAnimationFrame(autoPlayAnimId);
      if (btnAutoPlay) btnAutoPlay.textContent = '▶ 자동 순항';
      modal.classList.remove('show');
      setTimeout(() => {
        if (!modal.classList.contains('show')) {
          modal.style.display = 'none';
        }
      }, 200);
    };

    this.openNAxisStudioModal = openModal;
    this.closeNAxisStudioModal = closeModal;
    this.getNAxisStudioState = getNAxisStudioState;

    if (btnRail) btnRail.onclick = () => openModal();
    if (btnQuick) btnQuick.onclick = () => openModal();
    if (btnClose) btnClose.onclick = closeModal;

    // 🌟 [아이디어 C: N축 4분할 화면을 원클릭으로 메인 칠판 보관 카드(#1, #2...)로 즉시 전송!] 🌟
    if (btnArchive) {
      btnArchive.onclick = (e) => {
        e.stopPropagation();
        renderStudio(true);
        const dataUrl = canvas.toDataURL('image/png');
        renderStudio(false);
        let studioSnapshotStr = null;
        try {
          const baseSnap = JSON.parse(this.getPureGraphSnapshot());
          baseSnap.isNAxisStudioCard = true;
          baseSnap.nAxisStudioState = getNAxisStudioState();
          studioSnapshotStr = JSON.stringify(baseSnap);
        } catch (_) {
          studioSnapshotStr = JSON.stringify({
            isNAxisStudioCard: true,
            nAxisStudioState: getNAxisStudioState()
          });
        }
        closeModal();
        this.setGraphCard(dataUrl, canvas, 520, { x: 480, y: 80, w: 520, h: 310 }, studioSnapshotStr);
        this.showToast('📋 N축 합성함수 다이어그램을 캔버스 카드로 보관했습니다!');
      };
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        closeModal();
      }
    });

    if (sliderX) {
      sliderX.addEventListener('input', (e) => {
        if (isAutoPlaying) return;
        const rawX = parseFloat(e.target.value);
        currentX = applyCriticalSnap(rawX);
        renderStudio();
      });
    }

    // 🌟 [아이디어 A: 마우스 단순 이동(hover) 시 레이저 도망 방지 -> 클릭/드래그 시에만 정밀 스크러빙 + 특징점 자석 스냅!] 🌟
    let isScrubbingCanvas = false;
    const scrubFromPointerEvent = (e) => {
      if (isAutoPlaying) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / (rect.width || canvas.width);
      const scaleY = canvas.height / (rect.height || canvas.height);
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      let nextX = null;
      if (mx < midX && my > midY) {
        // 좌하단 속함수 영역: 세로 방향(x축) 드래그
        const pad = 38;
        const h = (canvas.height - midY) - pad * 2;
        const clampedY = Math.max(midY + pad, Math.min(canvas.height - pad, my));
        nextX = xMin + ((clampedY - (midY + pad)) / h) * (xMax - xMin);
      } else if (mx >= midX && my <= midY) {
        // 우상단 합성함수 영역: 가로 방향(x축) 드래그
        const pad = 50;
        const w = (canvas.width - midX) - pad * 2;
        const clampedX = Math.max(midX + pad, Math.min(canvas.width - pad, mx));
        nextX = xMin + ((clampedX - (midX + pad)) / w) * (xMax - xMin);
      } else if (mx < midX && my <= midY) {
        // 좌상단 겉함수 영역 클릭 시: 클릭한 t값에 가장 가까운 g(x) 지점으로 이동
        const margin = 50;
        const w = midX - margin * 2;
        const targetT = tMin + ((Math.max(margin, Math.min(midX - margin, mx)) - margin) / w) * (tMax - tMin);
        let bestX = currentX, bestDiff = Infinity;
        const M = 200;
        for (let i = 0; i <= M; i++) {
          const candX = xMin + (i / M) * (xMax - xMin);
          const candT = evalG(candX);
          if (isFinite(candT)) {
            const d = Math.abs(candT - targetT) + Math.abs(candX - currentX) * 0.08;
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
      if (isAutoPlaying && btnAutoPlay) {
        btnAutoPlay.click(); // 드래그 시작 시 자동순항 일시정지
      }
      isScrubbingCanvas = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      scrubFromPointerEvent(e);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isScrubbingCanvas) return;
      scrubFromPointerEvent(e);
    });

    const stopScrubbing = (e) => {
      if (!isScrubbingCanvas) return;
      isScrubbingCanvas = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { }
    };
    canvas.addEventListener('pointerup', stopScrubbing);
    canvas.addEventListener('pointercancel', stopScrubbing);

    if (btnAutoPlay) {
      btnAutoPlay.addEventListener('click', () => {
        isAutoPlaying = !isAutoPlaying;
        btnAutoPlay.textContent = isAutoPlaying ? '⏸ 정지' : '▶ 자동 순항';
        if (isAutoPlaying) {
          if (currentX >= xMax - 0.05) currentX = xMin;
          loopAutoPlay();
        } else if (autoPlayAnimId) {
          cancelAnimationFrame(autoPlayAnimId);
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

    const tabBtnCustom = document.getElementById('tabBtnNAxisCustom');
    const tabBtnPresets = document.getElementById('tabBtnNAxisPresets');
    const tabCustom = document.getElementById('tabContentNAxisCustom');
    const tabPresets = document.getElementById('tabContentNAxisPresets');

    const switchTab = (tab) => {
      if (tabCustom) tabCustom.style.display = (tab === 'custom') ? 'flex' : 'none';
      if (tabPresets) tabPresets.style.display = (tab === 'presets') ? 'flex' : 'none';
      if (tabBtnCustom) tabBtnCustom.classList.toggle('active', tab === 'custom');
      if (tabBtnPresets) tabBtnPresets.classList.toggle('active', tab === 'presets');
    };

    if (tabBtnCustom) tabBtnCustom.onclick = () => switchTab('custom');
    if (tabBtnPresets) tabBtnPresets.onclick = () => switchTab('presets');
    const btnGoCustom = document.getElementById('btnNAxisGoCustom');
    if (btnGoCustom) btnGoCustom.onclick = () => switchTab('custom');

    if (inputG) inputG.addEventListener('input', updateFormulas);
    if (inputF) inputF.addEventListener('input', updateFormulas);

    modal.querySelectorAll('.n-axis-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const val = e.currentTarget.dataset.val;
        const targetInput = document.getElementById(targetId);
        if (targetInput) {
          targetInput.value = val;
          updateFormulas();
        }
      });
    });

    const btnAutoFit = document.getElementById('btnNAxisAutoFit');
    const btnAutoFit2 = document.getElementById('btnNAxisAutoFit2');
    if (btnAutoFit) btnAutoFit.onclick = () => { autoFitRange(); renderStudio(); };
    if (btnAutoFit2) btnAutoFit2.onclick = () => { autoFitRange(); renderStudio(); };

    const btnSwap = document.getElementById('btnNAxisSwap');
    if (btnSwap) {
      btnSwap.onclick = () => {
        if (!inputG || !inputF) return;
        const oldG = inputG.value;
        const oldF = inputF.value;
        // 단어 경계(\b)를 사용하여 sqrt, atan 등의 t가 깨지지 않도록 안전하게 변수 치환!
        inputG.value = oldF.replace(/\bt\b/g, 'x');
        inputF.value = oldG.replace(/\bx\b/g, 't');
        updateFormulas();
      };
    }

    modal.querySelectorAll('.n-axis-preset-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.preset;
        if (key === 'csat2022') {
          if (inputG) inputG.value = '2.5 * cos(x)';
          if (inputF) inputF.value = 't^3 - 3*t';
          xMin = -Math.PI; xMax = Math.PI;
        } else if (key === 'mock2023') {
          if (inputG) inputG.value = '0.8*x^2 - 1.8';
          if (inputF) inputF.value = '0.25*(t^4 - 4*t^2)';
          xMin = -2.5; xMax = 2.5;
        } else if (key === 'absKiller') {
          if (inputG) inputG.value = '0.4*x^3 - 1.6*x';
          if (inputF) inputF.value = '|t| - 1.5';
          xMin = -2.4; xMax = 2.4;
        } else if (key === 'sinBasic') {
          if (inputG) inputG.value = '2 * sin(x)';
          if (inputF) inputF.value = 't^3 - 3*t';
          xMin = -Math.PI; xMax = Math.PI;
        }
        if (sliderX) {
          sliderX.min = xMin;
          sliderX.max = xMax;
          sliderX.value = (xMin + xMax) / 2 + 0.3;
        }
        currentX = sliderX ? parseFloat(sliderX.value) : 0.5;
        updateFormulas();
        switchTab('custom');
      });
    });

    // 초기 특이점 스냅 테이블 생성
    computeCriticalSnapPoints();
  }

  initShareModal() {
    this.exportScope = 'current';
    this.exportFilter = {
      includeProblem: true,
      includeGraph: true,
      includeInk: true,
      includeAudio: true
    };

    const modal = document.getElementById('modalShare');
    const btnOpen = document.getElementById('btnOpenShareModal');
    const btnClose = document.getElementById('btnCloseShareModal');
    const btnCloseFooter = document.getElementById('btnCloseShare');
    const inputShare = document.getElementById('inputShareLink');
    const inputStudent = document.getElementById('inputStudentLink');
    const btnCopyShare = document.getElementById('btnCopyShareLink');
    const lblBtnCopyShare = document.getElementById('lblBtnCopyShareLink');
    const btnCopyStudent = document.getElementById('btnCopyStudentLink');
    const btnDownloadQr = document.getElementById('btnDownloadQr');
    const qrCanvas = document.getElementById('qrCanvas');
    const resetBar = document.getElementById('sharedResetBar');
    const btnReset = document.getElementById('btnResetToOriginal');
    const btnReturnViewer = document.getElementById('btnReturnToSmartViewer');
    const btnCloseResetBar = document.getElementById('btnCloseResetBar');

    const btnScopeCur = document.getElementById('btnExportScopeCurrent');
    const btnScopeAll = document.getElementById('btnExportScopeAll');
    const lblTotalCount = document.getElementById('lblExportTotalSlidesCount');
    const chkProblem = document.getElementById('chkExportLayerProblem');
    const chkGraph = document.getElementById('chkExportLayerGraph');
    const chkInk = document.getElementById('chkExportLayerInk');
    const chkAudio = document.getElementById('chkExportLayerAudio');
    const lblProblem = document.getElementById('lblExportLayerProblem');
    const lblGraph = document.getElementById('lblExportLayerGraph');
    const lblInk = document.getElementById('lblExportLayerInk');
    const lblAudio = document.getElementById('lblExportLayerAudio');
    const btnStage0 = document.getElementById('btnExportPresetStage0');
    const btnStage1 = document.getElementById('btnExportPresetStage1');
    const btnStage2 = document.getElementById('btnExportPresetStage2');
    const btnStage3 = document.getElementById('btnExportPresetStage3');
    const lblSummary = document.getElementById('lblExportFilterSummary');

    const btnModalCopyImg = document.getElementById('btnExportModalCopyImg');
    const lblModalCopyImg = document.getElementById('lblExportModalCopyImg');
    const btnModalSavePng = document.getElementById('btnExportModalSavePng');
    const lblModalSavePng = document.getElementById('lblExportModalSavePng');
    const btnPreviewViewer = document.getElementById('btnPreviewSmartViewer');

    this._initSmartNoteViewerEvents();

    const triggerExportBtnSuccess = (btnEl, labelEl, tempText, origText, ms = 1850) => {
      const targetBtn = btnEl || (labelEl && labelEl.closest ? labelEl.closest('button') : null);
      const targetLbl = labelEl || targetBtn;
      if (!targetLbl) return;
      if (targetBtn) {
        if (targetBtn._fxResetTimer) {
          clearTimeout(targetBtn._fxResetTimer);
          targetBtn._fxResetTimer = null;
        }
        targetBtn.classList.remove('export-btn-success-fx');
        void targetBtn.offsetWidth;
        targetBtn.classList.add('export-btn-success-fx');
      }
      const sparkleSvg = `<svg class="export-btn-fx-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"/></svg>`;
      targetLbl.innerHTML = `<span class="export-btn-fx-content">${sparkleSvg}<span>${tempText}</span></span>`;
      const timerId = setTimeout(() => {
        if (targetBtn) {
          targetBtn.classList.remove('export-btn-success-fx');
          targetBtn._fxResetTimer = null;
        }
        if (targetLbl === lblModalSavePng) {
          const allSlidesNow = this._getActiveSlidesForExport('수업 노트');
          const isMultiNow = (this.exportScope === 'all' && allSlidesNow.length > 1);
          targetLbl.textContent = isMultiNow ? `PDF 저장 (${allSlidesNow.length}장)` : 'PNG 저장';
        } else {
          targetLbl.textContent = origText;
        }
      }, ms);
      if (targetBtn) {
        targetBtn._fxResetTimer = timerId;
      }
    };
    this.triggerExportBtnSuccess = triggerExportBtnSuccess;

    const syncFilterUI = () => {
      const allSlides = this._getActiveSlidesForExport('수업 노트');
      const totalCnt = allSlides.length;
      if (lblTotalCount) lblTotalCount.textContent = `(${totalCnt})`;
      if (btnScopeCur) btnScopeCur.classList.toggle('active', this.exportScope === 'current');
      if (btnScopeAll) btnScopeAll.classList.toggle('active', this.exportScope === 'all');

      const incP = Boolean(this.exportFilter.includeProblem);
      const incG = Boolean(this.exportFilter.includeGraph);
      const incI = Boolean(this.exportFilter.includeInk);
      const incA = this.exportFilter.includeAudio !== false;

      if (chkProblem) chkProblem.checked = incP;
      if (chkGraph) chkGraph.checked = incG;
      if (chkInk) chkInk.checked = incI;
      if (chkAudio) chkAudio.checked = incA;
      if (lblProblem) lblProblem.classList.toggle('active', incP);
      if (lblGraph) lblGraph.classList.toggle('active', incG);
      if (lblInk) lblInk.classList.toggle('active', incI);
      if (lblAudio) lblAudio.classList.toggle('active', incA);

      const isStage0 = (incP && !incG && !incI && !incA);
      const isStage1 = (incP && incG && !incI && !incA);
      const isStage2 = (incP && incG && incI && !incA);
      const isStage3 = (incP && incG && incI && incA);
      if (btnStage0) btnStage0.classList.toggle('active', isStage0);
      if (btnStage1) btnStage1.classList.toggle('active', isStage1);
      if (btnStage2) btnStage2.classList.toggle('active', isStage2);
      if (btnStage3) btnStage3.classList.toggle('active', isStage3);

      const parts = [];
      if (incP) parts.push('문제');
      if (incG) parts.push('그래프');
      if (incI) parts.push('필기');
      if (incA) parts.push('음성');
      const isMultiSlideAll = (this.exportScope === 'all' && totalCnt > 1);
      const scopeText = isMultiSlideAll
        ? `전체 캔버스(${totalCnt}장)`
        : '현재 캔버스';
      if (lblModalSavePng) {
        lblModalSavePng.textContent = isMultiSlideAll
          ? `PDF 저장 (${totalCnt}장)`
          : 'PNG 저장';
      }
      if (lblSummary) {
        lblSummary.textContent = `✨ ${scopeText}의 [${parts.join(' + ')}] 영역만 깔끔한 직사각형으로 자동 스캔하여 내보냅니다.`;
      }
      const syncShareTierNoticeUI = () => {
        const lblTierNotice = document.getElementById('lblShareLinkTierNotice');
        if (!lblTierNotice) return;
        const usage = (typeof this.getShareDailyUsageStatus === 'function')
          ? this.getShareDailyUsageStatus()
          : null;
        const quota = (typeof this.getCurrentTierQuota === 'function') ? this.getCurrentTierQuota() : null;
        const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
        const tier = isLoggedIn
          ? ((typeof this.getUserSubscriptionTier === 'function') ? this.getUserSubscriptionTier() : (this.isProUser ? 'pro' : 'free'))
          : 'guest';

        let mainText = '';
        let subText = '';
        if (!isLoggedIn) {
          const days = (quota && Number(quota.shareExpiryDays) > 0) ? Number(quota.shareExpiryDays) : 3;
          const limit = (usage && usage.dailyLimit) ? usage.dailyLimit : 5;
          const rem = (usage && typeof usage.remainingCount === 'number') ? usage.remainingCount : limit;
          mainText = `즉석 단기 공유 · 오늘 ${rem}/${limit}회 남음 · ${days}일 후 만료`;
          subText = '수정 자동 반영 · 영구 링크는 클라우드 보관함 이용';
        } else if (tier === 'premium') {
          const days = (quota && Number(quota.shareExpiryDays) > 0) ? Number(quota.shareExpiryDays) : 7;
          mainText = `즉석 단기 공유 · 무제한 · ${days}일 후 자동 만료`;
          subText = '영구 링크 · 수정 반영은 클라우드 보관함에서 추출';
        } else if (tier === 'pro') {
          const days = (quota && Number(quota.shareExpiryDays) > 0) ? Number(quota.shareExpiryDays) : 7;
          mainText = `즉석 단기 공유 · 무제한 · ${days}일 후 자동 만료`;
          subText = '수정 자동 반영 · 영구 링크(Premium)는 보관함 이용';
        } else {
          const days = (quota && Number(quota.shareExpiryDays) > 0) ? Number(quota.shareExpiryDays) : 3;
          const limit = (usage && usage.dailyLimit) ? usage.dailyLimit : 5;
          const rem = (usage && typeof usage.remainingCount === 'number') ? usage.remainingCount : limit;
          mainText = `즉석 단기 공유 · 오늘 ${rem}/${limit}회 남음 · ${days}일 후 만료`;
          subText = '수정 자동 반영 · 영구 링크(Premium)는 보관함 이용';
        }

        lblTierNotice.innerHTML = `
          <div class="share-tier-notice-main">${mainText}</div>
          <div class="share-tier-notice-sub">
            <span class="share-tier-notice-sub-text">${subText}</span>
            <button type="button" id="btnShareNoticeOpenVault" class="share-tier-vault-link-btn">보관함 ▸</button>
          </div>
        `;
        const btnVault = lblTierNotice.querySelector('#btnShareNoticeOpenVault');
        if (btnVault) {
          btnVault.onclick = () => {
            const inpTitleEl = document.getElementById('inputShareModalDeckTitle');
            const carryTitle = (inpTitleEl && inpTitleEl.value.trim()) ? inpTitleEl.value.trim() : (this._lastShareModalDeckTitle || '');
            if (modal) modal.classList.remove('show');
            if (typeof this.openCloudHubModal === 'function') {
              this.openCloudHubModal({ prefillTitle: carryTitle });
            }
          };
        }
      };
      this.refreshShareTierNoticeUI = syncShareTierNoticeUI;
      syncShareTierNoticeUI();
      if (typeof this.syncShareModalPromoBannerUI === 'function') {
        this.syncShareModalPromoBannerUI();
      }
    };

    const renderQr = (urlStr) => {
      if (qrCanvas && window.MiniQRCode && urlStr) {
        try {
          window.MiniQRCode.drawToCanvas(urlStr, qrCanvas, {
            size: 240,
            padding: 10,
            fgColor: '#0f172a',
            bgColor: '#ffffff'
          });
        } catch (err) { }
      }
    };

    let cachedCloudShareUrl = '';
    let cachedCloudShareSig = '';
    let shareLinkGenerationPromise = null;

    this._invalidateShareModalLinkCache = () => {
      cachedCloudShareUrl = '';
      cachedCloudShareSig = '';
      shareLinkGenerationPromise = null;
    };

    const getShareFilterSig = () => {
      const f = this.exportFilter || {};
      const promoSig = typeof this._getPromoBannerSignature === 'function' ? this._getPromoBannerSignature() : 'nopromo';
      return `${this.exportScope}|${Boolean(f.includeProblem)}|${Boolean(f.includeGraph)}|${Boolean(f.includeInk)}|${f.includeAudio !== false}|${promoSig}`;
    };

    // ⚡ 체크박스·범위 변경 시에는 0.00초 만에 UI만 즉시 갱신 (무거운 스캔·클라우드 업로드·QR 렌더링 전혀 안 함!)
    const syncFilterAndInvalidateCache = () => {
      cachedCloudShareUrl = '';
      cachedCloudShareSig = '';
      shareLinkGenerationPromise = null;
      syncFilterUI();
      const baseUrl = window.location.href.split('#')[0];
      const codeNormal = window.GraphStateSerializer ? window.GraphStateSerializer.serialize(this, false) : '';
      const fallbackNormalUrl = `${baseUrl}#share=${codeNormal}`;
      if (inputShare) inputShare.value = fallbackNormalUrl;
      if (inputStudent) inputStudent.value = fallbackNormalUrl;
    };

    // 🚀 실제로 [공유 링크 복사] 또는 [QR 생성·저장] 버튼을 눌렀을 때만 클라우드 공유 링크 생성!
    // (비로그인 기기당 1일 3개 · 무료 회원 계정당 1일 3개 · Pro/Premium 무제한)
    const ensureCloudShareLinkOnDemand = async () => {
      const curSig = getShareFilterSig();
      if (cachedCloudShareUrl && cachedCloudShareSig === curSig) {
        return cachedCloudShareUrl;
      }
      if (shareLinkGenerationPromise && cachedCloudShareSig === curSig) {
        return await shareLinkGenerationPromise;
      }
      cachedCloudShareSig = curSig;
      const baseUrl = window.location.href.split('#')[0];

      const genTask = (async () => {
        try {
          const shortId = await this.createCloudSharePackage(this.exportScope, this.exportFilter);
          if (shortId) {
            const cloudUrl = `${baseUrl}#cloud=${shortId}`;
            cachedCloudShareUrl = cloudUrl;
            if (inputShare) inputShare.value = cloudUrl;
            if (inputStudent) inputStudent.value = cloudUrl;
            return cloudUrl;
          }
        } catch (err) { }
        cachedCloudShareUrl = '';
        cachedCloudShareSig = '';
        shareLinkGenerationPromise = null;
        return null;
      })();
      shareLinkGenerationPromise = genTask;
      return await genTask;
    };

    if (btnScopeCur) {
      btnScopeCur.onclick = () => {
        this.exportScope = 'current';
        syncFilterAndInvalidateCache();
      };
    }
    if (btnScopeAll) {
      btnScopeAll.onclick = () => {
        this.exportScope = 'all';
        syncFilterAndInvalidateCache();
      };
    }

    const onLayerToggle = (key, chkEl) => {
      if (!chkEl) return;
      this.exportFilter[key] = Boolean(chkEl.checked);
      if (!this.exportFilter.includeProblem && !this.exportFilter.includeGraph && !this.exportFilter.includeInk && !this.exportFilter.includeAudio) {
        this.exportFilter[key] = true;
        chkEl.checked = true;
      }
      syncFilterAndInvalidateCache();
    };
    if (chkProblem) chkProblem.onchange = () => onLayerToggle('includeProblem', chkProblem);
    if (chkGraph) chkGraph.onchange = () => onLayerToggle('includeGraph', chkGraph);
    if (chkInk) chkInk.onchange = () => onLayerToggle('includeInk', chkInk);
    if (chkAudio) chkAudio.onchange = () => onLayerToggle('includeAudio', chkAudio);

    const applyStagePreset = (stageNum) => {
      if (stageNum === 0) {
        this.exportFilter.includeProblem = true;
        this.exportFilter.includeGraph = false;
        this.exportFilter.includeInk = false;
        this.exportFilter.includeAudio = false;
      } else if (stageNum === 1) {
        this.exportFilter.includeProblem = true;
        this.exportFilter.includeGraph = true;
        this.exportFilter.includeInk = false;
        this.exportFilter.includeAudio = false;
      } else if (stageNum === 2) {
        this.exportFilter.includeProblem = true;
        this.exportFilter.includeGraph = true;
        this.exportFilter.includeInk = true;
        this.exportFilter.includeAudio = false;
      } else {
        this.exportFilter.includeProblem = true;
        this.exportFilter.includeGraph = true;
        this.exportFilter.includeInk = true;
        this.exportFilter.includeAudio = true;
      }
      syncFilterAndInvalidateCache();
    };
    if (btnStage0) btnStage0.onclick = () => applyStagePreset(0);
    if (btnStage1) btnStage1.onclick = () => applyStagePreset(1);
    if (btnStage2) btnStage2.onclick = () => applyStagePreset(2);
    if (btnStage3) btnStage3.onclick = () => applyStagePreset(3);

    if (btnModalCopyImg) {
      btnModalCopyImg.onclick = async () => {
        const copied = await this.copyToClipboard(this.exportFilter);
        triggerExportBtnSuccess(btnModalCopyImg, lblModalCopyImg, copied ? '복사 완료' : 'PNG 저장됨', '이미지 복사');
      };
    }

    if (btnModalSavePng) {
      btnModalSavePng.onclick = async () => {
        const allSlides = this._getActiveSlidesForExport('수업 노트');
        const isMulti = (this.exportScope === 'all' && allSlides.length > 1);
        const origLabel = isMulti ? `PDF 저장 (${allSlides.length}장)` : 'PNG 저장';
        await this.downloadExportImages(this.exportScope, this.exportFilter);
        triggerExportBtnSuccess(btnModalSavePng, lblModalSavePng, '저장 완료', origLabel);
      };
    }

    if (btnPreviewViewer) {
      btnPreviewViewer.onclick = async () => {
        if (modal) modal.classList.remove('show');
        const pkg = await this.buildExportSharePackageObject(this.exportScope, this.exportFilter);
        this._initialSharedCloudPkg = JSON.parse(JSON.stringify(pkg));
        await this.openSmartNoteViewer(pkg);
      };
    }

    const openModal = (defaultScope = null) => {
      if (defaultScope === 'all' || defaultScope === 'current') {
        this.exportScope = defaultScope;
      } else {
        const allSlides = this._getActiveSlidesForExport('수업 노트');
        this.exportScope = (allSlides && allSlides.length > 1) ? 'all' : 'current';
      }
      // 내보내기 창을 열 때는 항상 4개 항목 전체 선택(통합 마스터본)을 기본값으로 초기화
      this.exportFilter = {
        includeProblem: true,
        includeGraph: true,
        includeInk: true,
        includeAudio: true
      };
      const hasLiveGraphs = this.graphs && this.graphs.length > 0;
      const hasBackupGraphs = this._coveredGraphStateBackup && this._coveredGraphStateBackup.graphs && this._coveredGraphStateBackup.graphs.length > 0;
      if (!hasLiveGraphs && hasBackupGraphs) {
        const origGraphs = this.graphs;
        this.graphs = this._coveredGraphStateBackup.graphs;
        syncFilterAndInvalidateCache();
        this.graphs = origGraphs;
      } else {
        syncFilterAndInvalidateCache();
      }
      if (typeof this.syncExportCloudFolderSelect === 'function') {
        this.syncExportCloudFolderSelect();
      }
      if (modal) modal.classList.add('show');
    };

    this._openShareModalWithCloudPackage = openModal;

    const closeModal = () => {
      if (modal) modal.classList.remove('show');
    };

    if (btnOpen) btnOpen.onclick = () => openModal();
    if (btnClose) btnClose.onclick = closeModal;
    if (btnCloseFooter) btnCloseFooter.onclick = closeModal;

    const copyTextToClipboard = async (text) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch (err) { }
    };

    if (btnCopyShare) {
      btnCopyShare.onclick = async () => {
        if (lblBtnCopyShare) lblBtnCopyShare.textContent = '링크 생성 중...';
        const finalUrl = await ensureCloudShareLinkOnDemand();
        if (!finalUrl) {
          if (lblBtnCopyShare) lblBtnCopyShare.textContent = '공유 링크 복사';
          return;
        }
        await copyTextToClipboard(finalUrl);
        triggerExportBtnSuccess(btnCopyShare, lblBtnCopyShare, '링크 복사 완료', '공유 링크 복사');
      };
    }

    if (btnCopyStudent) {
      btnCopyStudent.onclick = async () => {
        const finalUrl = await ensureCloudShareLinkOnDemand();
        if (!finalUrl) return;
        await copyTextToClipboard(finalUrl);
      };
    }

    const lblBtnDownloadQr = document.getElementById('lblBtnDownloadQr');
    if (btnDownloadQr) {
      btnDownloadQr.onclick = async () => {
        if (!qrCanvas) return;
        if (lblBtnDownloadQr) lblBtnDownloadQr.textContent = 'QR 생성 중...';
        const finalUrl = await ensureCloudShareLinkOnDemand();
        if (!finalUrl) {
          if (lblBtnDownloadQr) lblBtnDownloadQr.textContent = 'QR 저장';
          return;
        }
        renderQr(finalUrl);
        const dataUrl = qrCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Graphly_QR_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        triggerExportBtnSuccess(btnDownloadQr, lblBtnDownloadQr, 'QR 저장 완료', 'QR 저장');
      };
    }

    if (btnReset) {
      btnReset.onclick = () => {
        if (this._initialSharedCloudPkg) {
          this.applyCloudSharePackage(this._initialSharedCloudPkg);
        } else if (this._initialSharedData) {
          this.applyState(this._initialSharedData);
        }
      };
    }

    if (btnReturnViewer) {
      btnReturnViewer.onclick = async () => {
        if (this._initialSharedCloudPkg) {
          await this.openSmartNoteViewer(this._initialSharedCloudPkg);
        } else {
          const pkg = await this.buildExportSharePackageObject('current', this.exportFilter);
          await this.openSmartNoteViewer(pkg);
        }
      };
    }

    if (btnCloseResetBar && resetBar) {
      btnCloseResetBar.onclick = () => {
        resetBar.style.display = 'none';
      };
    }

    // 📚 [내 보관함 / 내 드라이브(.graphly) 저장 (선택한 범위 & 요소 필터 반영)]
    const inpDeckTitle = document.getElementById('inputShareModalDeckTitle');
    const inpDeckTags = document.getElementById('inputShareModalDeckTags');
    const btnShareToLib = document.getElementById('btnShareModalToLibrary');
    const lblShareToLib = document.getElementById('lblShareModalToLibrary');
    const btnShareExportFile = document.getElementById('btnShareModalExportFile');
    const lblShareExportFile = document.getElementById('lblShareModalExportFile');

    // 브라우저 자동완성 드롭다운 차단 및 내보내기 ⇄ 클라우드 파일명 실시간 연동
    [inpDeckTitle, inpDeckTags, document.getElementById('inputCloudSaveTitle')].forEach((inp) => {
      if (!inp) return;
      inp.setAttribute('autocomplete', 'off');
      inp.setAttribute('autocorrect', 'off');
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('spellcheck', 'false');
      inp.setAttribute('aria-autocomplete', 'none');
      inp.addEventListener('focus', () => {
        inp.setAttribute('name', 'graphly_nofill_' + Date.now());
      });
    });

    if (inpDeckTitle) {
      const syncDeckTitleToCloud = () => {
        const val = inpDeckTitle.value.trim();
        this._lastShareModalDeckTitle = val;
        const inpCloud = document.getElementById('inputCloudSaveTitle');
        if (inpCloud) {
          inpCloud.value = val;
        }
      };
      inpDeckTitle.addEventListener('input', syncDeckTitleToCloud);
      inpDeckTitle.addEventListener('change', syncDeckTitleToCloud);
    }

    const getShareModalFilteredSlides = () => {
      const fallbackTitle = (inpDeckTitle && inpDeckTitle.value.trim()) ? inpDeckTitle.value.trim() : '공유된 수업 세트';
      return this._getFilteredSlidesForExport(fallbackTitle, this.exportScope, this.exportFilter);
    };

    const getExportStageSuffixLabel = () => {
      const f = this.exportFilter || {};
      const p = f.includeProblem !== false;
      const g = f.includeGraph !== false;
      const i = f.includeInk !== false;
      const a = f.includeAudio !== false;
      if (p && !g && !i && !a) return '[문제]';
      if (p && g && !i && !a) return '[문제+그래프]';
      if (p && g && i && !a) return '[문제+그래프+필기]';
      if (p && g && i && a) return '[통합본]';
      const names = [];
      if (p) names.push('문제');
      if (g) names.push('그래프');
      if (i) names.push('필기');
      if (a) names.push('음성');
      return `[${names.join('+')}]`;
    };

    if (btnShareToLib) {
      btnShareToLib.onclick = async () => {
        const carryTitle = (inpDeckTitle && inpDeckTitle.value.trim())
          ? inpDeckTitle.value.trim()
          : (this._lastShareModalDeckTitle || '');
        const modalShare = document.getElementById('modalShare');
        if (modalShare) modalShare.classList.remove('show');
        this._returnToShareModalAfterCloudSave = true;
        this._pendingExportCloudFilter = {
          includeProblem: !this.exportFilter || this.exportFilter.includeProblem !== false,
          includeGraph: !this.exportFilter || this.exportFilter.includeGraph !== false,
          includeInk: !this.exportFilter || this.exportFilter.includeInk !== false,
          includeAudio: !this.exportFilter || this.exportFilter.includeAudio !== false
        };
        this._cloudExplorerSaveScope = (this.exportScope === 'current') ? 'current' : 'all';
        const inpCloudTitle = document.getElementById('inputCloudSaveTitle');
        if (inpCloudTitle && carryTitle) {
          inpCloudTitle.value = carryTitle;
        }
        this.openCloudHubModal({ fromExportModal: true, prefillTitle: carryTitle });
      };
    }

    if (btnShareExportFile) {
      btnShareExportFile.onclick = async () => {
        if (this.isAudioRecording) {
          await this.stopAudioRecording();
        } else if (this._pendingSlideAudioFinalizers && this._pendingSlideAudioFinalizers.length > 0) {
          await Promise.all(this._pendingSlideAudioFinalizers).catch(() => { });
          this._pendingSlideAudioFinalizers = [];
        }
        const slides = getShareModalFilteredSlides();
        const stageSuffix = getExportStageSuffixLabel();
        const defaultTitle = slides.length > 1
          ? `Graphly_${slides.length}문항_${stageSuffix}`
          : `${slides[0].slideTitle || 'Graphly_수업노트'}_${stageSuffix}`;
        const typedTitle = (inpDeckTitle && inpDeckTitle.value.trim()) ? inpDeckTitle.value.trim() : '';
        if (typedTitle) {
          this._lastShareModalDeckTitle = typedTitle;
          const inpCloudTitle = document.getElementById('inputCloudSaveTitle');
          if (inpCloudTitle) inpCloudTitle.value = typedTitle;
        }
        const title = typedTitle || defaultTitle;
        const tags = (inpDeckTags && inpDeckTags.value.trim()) ? inpDeckTags.value.trim() : `#수업노트 ${stageSuffix}`;
        await this.exportGraphlyDeckFile(title, tags, slides, this.exportFilter);
        triggerExportBtnSuccess(btnShareExportFile, lblShareExportFile, '파일 저장 완료', '내 기기에 저장');
      };
    }
  }

  // --- [URL 해시에서 상태 복원 및 스마트 판서 이미지 뷰어 자동 진입 엔진 (#cloud= & #share=)] ---
  checkUrlHashForState() {
    const hash = window.location.hash;
    if (!hash) return;

    if (hash.includes('cloud=')) {
      const m = hash.match(/cloud=([A-Za-z0-9_-]+)/);
      if (m && m[1]) {
        const shortId = m[1];
        const isStudent = hash.includes('student=1') || hash.includes('student=true');
        this.restoreFromCloudShareId(shortId, isStudent);
      }
      return;
    }

    if (!hash.includes('share=') && !hash.includes('student=')) return;

    if (!window.GraphStateSerializer) return;
    const data = window.GraphStateSerializer.deserialize(hash);
    if (!data || !data.g) return;

    this._initialSharedData = JSON.parse(JSON.stringify(data));
    this.applyState(data);

    // #share= / #student= 단일 그래프 링크도 스마트 이미지 뷰어(그래프 터치 조작 포함)로 즉시 오픈!
    setTimeout(async () => {
      const pkg = await this.buildExportSharePackageObject('current', {
        includeProblem: true,
        includeGraph: true,
        includeInk: true
      });
      this._initialSharedCloudPkg = JSON.parse(JSON.stringify(pkg));
      await this.openSmartNoteViewer(pkg);
    }, 120);
  }
}
