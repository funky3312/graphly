/**
 * Graph Master Web - Google Auth, Cloud Hub, Subscription Quota, Custom Presets, .graphly File & Smart Viewer (app-cloud.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
    // ============================================================================
    // ☁️ [클라우드 보관함 · 수업 슬라이드(PPT) · 기출 게시판 & 통합 공유 엔진]
    // ============================================================================
    _escapeHtmlStr(val) {
      return String(val == null ? '' : val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    _sanitizeCustomGraphSvgThumb(rawSvg) {
      if (!rawSvg || typeof rawSvg !== 'string') return '📈';
      const trimmed = rawSvg.trim();
      if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) return '📈';
      if (/<script|<foreignobject|<iframe|<object|<embed|<img|javascript:|data:text\/html|\bon[a-z]+\s*=|\bhref\s*=|\bxlink:href\s*=/i.test(trimmed)) {
        return '📈';
      }
      return trimmed;
    }

    async _getFirebaseIdTokenForRest(waitForAuthInit = true) {
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return '';
      }
      if (typeof this._ensureFirebaseInitialized === 'function') {
        this._ensureFirebaseInitialized();
      }
      if (this._fbAuth && this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
        try {
          return await this._fbAuth.currentUser.getIdToken(false);
        } catch (e) {
          return '';
        }
      }
      if (waitForAuthInit && this.cloudUser && !this._fbAuthInitialResolved && this._fbAuthReadyPromise) {
        try {
          await Promise.race([
            this._fbAuthReadyPromise,
            new Promise((resolve) => setTimeout(resolve, 2500))
          ]);
        } catch (e) { }
        if (this._fbAuth && this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
          try {
            return await this._fbAuth.currentUser.getIdToken(false);
          } catch (e) {
            return '';
          }
        }
      }
      return '';
    }

    async _buildFirestoreRestHeaders(includeJsonContentType = false, waitForAuthInit = true) {
      const headers = {};
      if (includeJsonContentType) {
        headers['Content-Type'] = 'application/json';
      }
      const idToken = await this._getFirebaseIdTokenForRest(waitForAuthInit);
      if (idToken) {
        headers['Authorization'] = 'Bearer ' + idToken;
      }
      return headers;
    }

    _detectInAppBrowserInfo() {
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? String(navigator.userAgent) : '';
      if (!ua) return { isInApp: false, appName: '', isAndroid: false, isIOS: false, isKakao: false };
      const isAndroid = /Android/i.test(ua);
      const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
      const isKakao = /KAKAOTALK/i.test(ua);
      const isNaver = /NAVER\(inapp/i.test(ua);
      const isInstagram = /Instagram/i.test(ua);
      const isFacebook = /FBAN|FBAV|FB_IAB/i.test(ua);
      const isLine = /\bLine\//i.test(ua);
      const isEverytime = /everytimeApp/i.test(ua);
      const isDaum = /DaumApps/i.test(ua);
      const isInApp = Boolean(isKakao || isNaver || isInstagram || isFacebook || isLine || isEverytime || isDaum);
      const appName = isKakao ? '카카오톡'
        : isNaver ? '네이버 앱'
          : isInstagram ? '인스타그램'
            : isFacebook ? '페이스북'
              : isLine ? '라인'
                : isEverytime ? '에브리타임'
                  : isDaum ? '다음 앱'
                    : '인앱';
      return { isInApp, appName, isAndroid, isIOS, isKakao };
    }

    initCloudHubAndPlaylist() {
      this._firebaseProjectId = 'graphly-net';
      this._firebaseConfig = {
        apiKey: "AIzaSyDW9F0xpg05IfG82L3H5nBMTXOs9XYtwpU",
        authDomain: "graphly-net.firebaseapp.com",
        projectId: "graphly-net",
        storageBucket: "graphly-net.firebasestorage.app",
        messagingSenderId: "934768067823",
        appId: "1:934768067823:web:c7601110f7d4878680071a",
        measurementId: "G-FRVVPNGN57"
      };

      this._cloudIdAuthTab = 'login';
      this._isExplicitAuthFlowInProgress = false;
      this._lastSessionLockRegisteredAt = 0;
      this._pendingSessionLockWritePromise = null;
      this._fbAuthInitialResolved = false;
      this._fbAuthReadyPromise = new Promise((resolve) => {
        this._resolveFbAuthReady = resolve;
      });
      this.myLibraryCache = [];
      this._restoreActiveCloudUserSession();
      this._loadPromoBannerConfigForCurrentUser();
      if (this.cloudUser && this.cloudUser.uid) {
        this.syncUserProSubscriptionFromCloud();
        setTimeout(() => this.fetchMyLibraryFromCloud(), 500);
      }
      if (typeof this._idbCacheGet === 'function') {
        try {
          const curGuestId = localStorage.getItem('graphly_guest_device_id_v1');
          if (!curGuestId) {
            this._idbCacheGet('graphly_guest_device_id_v1').then((idbId) => {
              if (idbId && /^gdev_[a-f0-9]{24,64}$/.test(String(idbId))) {
                this._cachedGuestShareDeviceId = String(idbId);
                try { localStorage.setItem('graphly_guest_device_id_v1', String(idbId)); } catch (_) { }
              }
            }).catch(() => { });
          }
        } catch (e) { }
      }

      // 비동기로 Firebase SDK 초기화 및 OAuth 팝업 브리지 사전 예열 (판서/초기 로딩 블로킹 0%)
      this._applyFirebaseAuthUser = (user, forceAuthProvider = '', showWelcome = false) => {
        if (!user) return false;
        const savedProvider = forceAuthProvider || (this.cloudUser && this.cloudUser.authProvider) || localStorage.getItem('graphly_last_auth_provider') || '';
        const hasGoogle = Array.isArray(user.providerData) && user.providerData.some(p => p && p.providerId === 'google.com');
        const hasPassword = Array.isArray(user.providerData) && user.providerData.some(p => p && p.providerId === 'password');
        const isGoogleProvider = (forceAuthProvider === 'google')
          ? true
          : ((savedProvider === 'email' && hasPassword)
            ? false
            : (savedProvider === 'google' && hasGoogle ? true : (hasGoogle && !hasPassword)));
        if (!isGoogleProvider && !user.emailVerified) return false;
        const authProvider = isGoogleProvider ? 'google' : 'email';
        const normEmail = String(user.email || '').trim().toLowerCase();
        const canonicalUid = this._getCanonicalUidForEmail(normEmail, user.uid, authProvider);
        if (isGoogleProvider) {
          try { localStorage.setItem('graphly_last_auth_provider', 'google'); } catch (e) { }
        }
        this._applyLoggedInCloudUser({
          uid: canonicalUid,
          rawUid: String(user.uid || canonicalUid),
          authProvider: authProvider,
          providerLabel: isGoogleProvider ? 'Google 로그인' : '아이디 로그인',
          loginId: normEmail || user.uid,
          displayName: user.displayName || (normEmail ? normEmail.split('@')[0] : '선생님'),
          email: normEmail,
          emailVerified: true
        }, Boolean(showWelcome));
        return true;
      };

      this._prewarmFirebasePopupResolver = () => {
        try {
          if (
            this._fbAuth &&
            this._fbAuth._delegate &&
            this._fbAuth._delegate._popupRedirectResolver &&
            typeof this._fbAuth._delegate._popupRedirectResolver._initialize === 'function'
          ) {
            this._fbAuth._delegate._popupRedirectResolver._initialize(this._fbAuth._delegate).catch(() => { });
          }
        } catch (e) { }
      };

      const tryInitFirebase = () => {
        if (window.firebase && window.firebase.apps) {
          try {
            if (!window.firebase.apps.length) {
              window.firebase.initializeApp(this._firebaseConfig);
            }
            if (!this._fbAuth && window.firebase.auth) {
              this._fbAuth = window.firebase.auth();
            }
            if (!this._fbDb && window.firebase.firestore) {
              this._fbDb = window.firebase.firestore();
            }
            if (this._fbAuth && !this._fbAuthStateListenerBound) {
              this._fbAuthStateListenerBound = true;
              this._prewarmFirebasePopupResolver();
              if (typeof this._fbAuth.getRedirectResult === 'function') {
                this._fbAuth.getRedirectResult().then((redirectRes) => {
                  if (redirectRes && redirectRes.user) {
                    this._applyFirebaseAuthUser(redirectRes.user, 'google', true);
                  }
                }).catch(() => { });
              }
              this._fbAuth.onAuthStateChanged((user) => {
                this._fbAuthInitialResolved = true;
                if (this._resolveFbAuthReady) {
                  const fn = this._resolveFbAuthReady;
                  this._resolveFbAuthReady = null;
                  fn(user || null);
                }
                if (this._isExplicitAuthFlowInProgress) return;
                if (user) {
                  const savedProvider = (this.cloudUser && this.cloudUser.authProvider) || localStorage.getItem('graphly_last_auth_provider') || '';
                  const hasGoogle = Array.isArray(user.providerData) && user.providerData.some(p => p && p.providerId === 'google.com');
                  const hasPassword = Array.isArray(user.providerData) && user.providerData.some(p => p && p.providerId === 'password');
                  const isGoogleProvider = (savedProvider === 'email' && hasPassword)
                    ? false
                    : (savedProvider === 'google' && hasGoogle ? true : (hasGoogle && !hasPassword));
                  if (isGoogleProvider || user.emailVerified) {
                    const authProvider = isGoogleProvider ? 'google' : 'email';
                    const normEmail = String(user.email || '').trim().toLowerCase();
                    const canonicalUid = this._getCanonicalUidForEmail(normEmail, user.uid, authProvider);
                    const alreadySameUser = Boolean(this.cloudUser && this.cloudUser.uid === canonicalUid);
                    this.cloudUser = {
                      uid: canonicalUid,
                      rawUid: String(user.uid || canonicalUid),
                      authProvider: authProvider,
                      providerLabel: isGoogleProvider ? 'Google 로그인' : '아이디 로그인',
                      loginId: normEmail || user.uid,
                      displayName: user.displayName || (this.cloudUser && this.cloudUser.displayName) || (normEmail ? normEmail.split('@')[0] : '선생님'),
                      email: normEmail,
                      emailVerified: true,
                      isPro: Boolean(this.cloudUser && this.cloudUser.isPro)
                    };
                    this._persistActiveCloudUserSession();
                    if (!alreadySameUser) {
                      this._loadMyLibraryCacheForCurrentUser();
                      this.syncCloudAuthUI();
                      this.syncUserProSubscriptionFromCloud();
                      this.fetchMyLibraryFromCloud();
                    } else {
                      this.syncCloudAuthUI();
                      this.syncUserProSubscriptionFromCloud();
                    }
                    const sinceRegisterMs = Date.now() - (this._lastSessionLockRegisteredAt || 0);
                    if (sinceRegisterMs > 10000) {
                      this.verifyActiveDeviceSessionLock();
                    }
                  } else if (this.cloudUser && !this.cloudUser.isReviewerTest) {
                    this.cloudUser = null;
                    this.isProUser = false;
                    this._persistActiveCloudUserSession();
                    this.myLibraryCache = [];
                    this.syncCloudAuthUI();
                    this.renderMyLibraryList();
                    this.renderFuncList();
                  }
                } else if (
                  this.cloudUser &&
                  !this.cloudUser.isReviewerTest &&
                  (this._fbSignOutInProgress || (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)))
                ) {
                  this.cloudUser = null;
                  this.isProUser = false;
                  this._persistActiveCloudUserSession();
                  this.myLibraryCache = [];
                  this.syncCloudAuthUI();
                  this.renderMyLibraryList();
                  this.renderFuncList();
                }
              });
            }
            return Boolean(this._fbAuth);
          } catch (err) { }
        }
        return false;
      };
      this._ensureFirebaseInitialized = tryInitFirebase;
      tryInitFirebase();
      [150, 400, 1200, 3000].forEach(ms => {
        setTimeout(() => {
          if (!this._fbAuth) tryInitFirebase();
        }, ms);
      });

      if (!this._sessionLockVisibilityBound) {
        this._sessionLockVisibilityBound = true;
        const checkSessionOnFocus = () => {
          if (!this.cloudUser || !this.cloudUser.uid) return;
          if (this._isExplicitAuthFlowInProgress) return;
          if ((typeof this.isActivelyWritingOrInteracting === 'function' && this.isActivelyWritingOrInteracting()) || this.isDrawingInk || this._isDrawingCardInk) return;
          const now = Date.now();
          if (this._lastSessionLockRegisteredAt && (now - this._lastSessionLockRegisteredAt < 10000)) return;
          if (this._lastSessionLockCheckMs && now - this._lastSessionLockCheckMs < 15000) return;
          this._lastSessionLockCheckMs = now;
          this.verifyActiveDeviceSessionLock();
          this.syncUserProSubscriptionFromCloud();
        };
        window.addEventListener('focus', checkSessionOnFocus, { passive: true });
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) checkSessionOnFocus();
        }, { passive: true });
      }

      // 모달 및 버튼 바인딩
      const btnCloudHub = document.getElementById('btnCloudHub');
      const modalCloud = document.getElementById('modalCloudHub');
      const btnCloseCloud = document.getElementById('btnCloseCloudHub');
      const btnAuth = document.getElementById('btnCloudGoogleLogin');
      const btnSaveLib = document.getElementById('btnSaveToMyLibrary');
      const chkAll = document.getElementById('chkCloudSelectAll');
      const btnStartPlaylist = document.getElementById('btnStartLessonPlaylist');

      if (btnCloudHub) {
        btnCloudHub.onclick = () => this.openCloudHubModal();
      }
      if (btnCloseCloud) {
        btnCloseCloud.onclick = () => {
          if (typeof this.closeCloudItemSharePopover === 'function') {
            this.closeCloudItemSharePopover();
          }
          if (modalCloud) modalCloud.classList.remove('show');
        };
      }

      if (btnAuth) {
        btnAuth.onclick = () => this.handleCloudGoogleAuth();
      }
      const btnEmailToggle = document.getElementById('btnCloudEmailLoginToggle');
      const boxEmailLogin = document.getElementById('cloudEmailLoginBox');
      const btnSubmitEmail = document.getElementById('btnSubmitCloudEmailLogin');
      const tabBtnIdLogin = document.getElementById('tabBtnCloudIdLogin');
      const tabBtnIdSignup = document.getElementById('tabBtnCloudIdSignup');
      const btnProGoLogin = document.getElementById('btnProModalGoLogin');
      const btnVerifyCheckNow = document.getElementById('btnVerifyEmailCheckNow');
      const btnResendVerify = document.getElementById('btnResendVerificationEmail');
      const btnResetEmailPw = document.getElementById('btnResetEmailPassword');
      const btnSettingsGoogleLogin = document.getElementById('btnSettingsGoogleLogin');
      const btnSettingsEmailLogin = document.getElementById('btnSettingsEmailLogin');
      const btnSettingsOpenVault = document.getElementById('btnSettingsOpenVault');
      const btnSettingsLogout = document.getElementById('btnSettingsLogout');
      if (btnEmailToggle && boxEmailLogin) {
        btnEmailToggle.onclick = () => {
          const willOpen = boxEmailLogin.style.display === 'none';
          boxEmailLogin.style.display = willOpen ? 'block' : 'none';
          if (willOpen) this.switchCloudIdAuthTab(this._cloudIdAuthTab || 'login');
        };
      }
      if (tabBtnIdLogin) {
        tabBtnIdLogin.onclick = () => this.switchCloudIdAuthTab('login');
      }
      if (tabBtnIdSignup) {
        tabBtnIdSignup.onclick = () => this.switchCloudIdAuthTab('signup');
      }
      if (btnSubmitEmail) {
        btnSubmitEmail.onclick = () => this.handleCloudEmailPasswordLogin();
      }
      ['inputCloudEmailId', 'inputCloudEmailPw', 'inputCloudEmailPwConfirm', 'inputCloudSignupName'].forEach(inpId => {
        const inpEl = document.getElementById(inpId);
        if (inpEl) {
          inpEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this.handleCloudEmailPasswordLogin();
            }
          });
        }
      });
      if (btnVerifyCheckNow) {
        btnVerifyCheckNow.onclick = () => this.verifyPendingEmailAndLogin();
      }
      if (btnResendVerify) {
        btnResendVerify.onclick = () => this.resendEmailVerificationLink();
      }
      if (btnResetEmailPw) {
        btnResetEmailPw.onclick = () => this.handleResetEmailPassword();
      }
      if (btnProGoLogin) {
        btnProGoLogin.onclick = () => {
          const proModal = document.getElementById('modalProPricing');
          if (proModal) proModal.classList.remove('show');
          this.promptCloudLoginForLibrary('🔑 좌측 설정창의 [계정]에서 로그인해 주세요.');
        };
      }
      if (btnSettingsGoogleLogin) {
        btnSettingsGoogleLogin.addEventListener('pointerenter', () => {
          if (typeof this._ensureFirebaseInitialized === 'function') this._ensureFirebaseInitialized();
          if (typeof this._prewarmFirebasePopupResolver === 'function') this._prewarmFirebasePopupResolver();
        }, { passive: true });
        btnSettingsGoogleLogin.onclick = () => this.handleCloudGoogleAuth();
      }
      if (btnSettingsEmailLogin) {
        btnSettingsEmailLogin.onclick = () => {
          if (boxEmailLogin) {
            const willOpen = boxEmailLogin.style.display === 'none';
            boxEmailLogin.style.display = willOpen ? 'block' : 'none';
            if (willOpen) {
              this.switchCloudIdAuthTab(this._cloudIdAuthTab || 'login');
              const inpEmail = document.getElementById('inputCloudEmailId');
              if (inpEmail) setTimeout(() => inpEmail.focus(), 60);
            }
          }
        };
      }
      if (btnSettingsOpenVault) {
        btnSettingsOpenVault.onclick = () => this.openCloudHubModal();
      }
      if (btnSettingsLogout) {
        btnSettingsLogout.onclick = () => this.handleCloudLogout();
      }
      const btnRailSettings = document.getElementById('btnRailSettings');
      if (btnRailSettings) {
        btnRailSettings.addEventListener('click', () => {
          if (this.cloudUser && typeof this.refreshAccountSubscriptionStatusUI === 'function') {
            this.refreshAccountSubscriptionStatusUI();
          }
        }, { passive: true });
      }

      // 🔍 클라우드 보관함(윈도우 탐색기) 상단 툴바 & 폴더/하위폴더 추가 & 하단 저장/선택 관리 바 컨트롤 바인딩
      const inpLibSearch = document.getElementById('inputCloudLibrarySearch');
      const btnNavUp = document.getElementById('btnCloudNavUp');
      const btnAddRootFolder = document.getElementById('btnCloudAddRootFolder');
      const btnActionOpen = document.getElementById('btnCloudActionOpen');
      const btnFooterOpen = document.getElementById('btnCloudFooterOpen');
      const btnActionDownload = document.getElementById('btnCloudActionDownload');
      const btnActionMove = document.getElementById('btnCloudActionMove');
      const moveMenuEl = document.getElementById('cloudMoveDropdownMenu');
      const btnActionDelete = document.getElementById('btnCloudActionDelete');
      const btnClearSelection = document.getElementById('btnCloudClearSelection');
      const chkExplorerAll = document.getElementById('chkCloudExplorerAll');
      const rowNewFolder = document.getElementById('cloudNewFolderInlineRow');
      const inpNewFolder = document.getElementById('inputNewCloudFolderName');
      const btnConfirmFolder = document.getElementById('btnConfirmNewCloudFolder');
      const btnCancelFolder = document.getElementById('btnCancelNewCloudFolder');
      const btnScopeAll = document.getElementById('btnCloudSaveScopeAll');
      const btnScopeCur = document.getElementById('btnCloudSaveScopeCurrent');
      const inpCloudSaveTitle = document.getElementById('inputCloudSaveTitle');
      const sidebarSplitEl = document.getElementById('cloudExplorerSplitter');
      const sidebarPaneEl = document.getElementById('cloudExplorerSidebar');

      // ↔️ 좌측 폴더 트리 폭 조절선 (마우스 · 아이패드 터치 · 펜 드래그 및 더블클릭 초기화)
      if (sidebarSplitEl && sidebarPaneEl) {
        try {
          const savedW = parseInt(localStorage.getItem('graphly_cloud_sidebar_w_v1') || '', 10);
          if (savedW >= 115 && savedW <= 360) {
            sidebarPaneEl.style.width = `${savedW}px`;
          }
        } catch (e) { }

        let isDraggingSplit = false;
        let startX = 0;
        let startW = 168;

        sidebarSplitEl.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          isDraggingSplit = true;
          startX = e.clientX;
          startW = sidebarPaneEl.getBoundingClientRect().width || 168;
          sidebarSplitEl.classList.add('is-dragging');
          try { sidebarSplitEl.setPointerCapture(e.pointerId); } catch (err) { }
        });

        sidebarSplitEl.addEventListener('pointermove', (e) => {
          if (!isDraggingSplit) return;
          e.preventDefault();
          const layoutEl = document.getElementById('panelCloudMyLibrary');
          const maxAllowed = layoutEl ? Math.min(360, Math.max(180, layoutEl.getBoundingClientRect().width - 180)) : 320;
          const nextW = Math.max(115, Math.min(maxAllowed, Math.round(startW + (e.clientX - startX))));
          sidebarPaneEl.style.width = `${nextW}px`;
        });

        const endSplitDrag = (e) => {
          if (!isDraggingSplit) return;
          isDraggingSplit = false;
          sidebarSplitEl.classList.remove('is-dragging');
          try {
            if (e && e.pointerId !== undefined) sidebarSplitEl.releasePointerCapture(e.pointerId);
          } catch (err) { }
          try {
            const finalW = Math.round(sidebarPaneEl.getBoundingClientRect().width || 168);
            localStorage.setItem('graphly_cloud_sidebar_w_v1', String(finalW));
          } catch (err) { }
        };

        sidebarSplitEl.addEventListener('pointerup', endSplitDrag);
        sidebarSplitEl.addEventListener('pointercancel', endSplitDrag);
        sidebarSplitEl.addEventListener('dblclick', (e) => {
          e.preventDefault();
          e.stopPropagation();
          sidebarPaneEl.style.width = '208px';
          try { localStorage.setItem('graphly_cloud_sidebar_w_v1', '208'); } catch (err) { }
        });
      }

      if (!this._boundCloudHubF2Shortcut) {
        this._boundCloudHubF2Shortcut = true;
        window.addEventListener('keydown', (e) => {
          if (e.key !== 'F2') return;
          const modalEl = document.getElementById('modalCloudHub');
          if (!modalEl || !modalEl.classList.contains('show')) return;
          const activeTag = document.activeElement && document.activeElement.tagName
            ? document.activeElement.tagName.toUpperCase()
            : '';
          if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
          if (!this._selectedCloudExplorerKeys || this._selectedCloudExplorerKeys.size !== 1) return;
          const onlyKey = Array.from(this._selectedCloudExplorerKeys)[0] || '';
          if (onlyKey.startsWith('folder:')) {
            e.preventDefault();
            this._renamingCloudFolderPath = onlyKey.slice(7);
            this.renderMyLibraryList();
          } else if (onlyKey.startsWith('file:')) {
            e.preventDefault();
            this._renamingCloudItemId = onlyKey.slice(5);
            this.renderMyLibraryList();
          }
        });
      }

      this._selectedCloudExplorerKeys = new Set();
      this._cloudExplorerSaveScope = 'all';
      const setCloudExplorerScope = (scope) => {
        this._cloudExplorerSaveScope = (scope === 'current') ? 'current' : 'all';
        if (btnScopeAll) btnScopeAll.classList.toggle('active', this._cloudExplorerSaveScope === 'all');
        if (btnScopeCur) btnScopeCur.classList.toggle('active', this._cloudExplorerSaveScope === 'current');
      };
      this._syncCloudExplorerScopeUI = () => {
        const totalCnt = (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0)
          ? this.lessonPlaylistSlides.length
          : 1;
        if (btnScopeAll) {
          btnScopeAll.textContent = `전체 (${totalCnt}장)`;
        }
        setCloudExplorerScope(this._cloudExplorerSaveScope || 'all');
      };
      if (btnScopeAll) btnScopeAll.onclick = () => setCloudExplorerScope('all');
      if (btnScopeCur) btnScopeCur.onclick = () => setCloudExplorerScope('current');
      if (inpCloudSaveTitle) {
        inpCloudSaveTitle.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.saveCurrentToMyLibrary();
          }
        };
      }

      if (btnActionOpen) {
        btnActionOpen.onclick = () => this.handleCloudExplorerOpenSelected();
      }
      if (btnFooterOpen) {
        btnFooterOpen.onclick = () => this.handleCloudExplorerOpenSelected();
      }
      if (btnActionDownload) {
        btnActionDownload.onclick = () => this.handleCloudExplorerDownloadSelected();
      }
      if (btnActionMove) {
        btnActionMove.onclick = (e) => {
          e.stopPropagation();
          this.toggleCloudExplorerMoveMenu();
        };
      }
      if (btnActionDelete) {
        btnActionDelete.onclick = () => this.handleCloudExplorerDeleteSelected();
      }
      if (btnClearSelection) {
        btnClearSelection.onclick = () => {
          if (this._selectedCloudExplorerKeys) this._selectedCloudExplorerKeys.clear();
          if (moveMenuEl) moveMenuEl.style.display = 'none';
          this.renderMyLibraryList();
        };
      }
      if (chkExplorerAll) {
        chkExplorerAll.onchange = () => {
          const visibleKeys = Array.isArray(this._currentVisibleCloudKeys) ? this._currentVisibleCloudKeys : [];
          if (chkExplorerAll.checked) {
            visibleKeys.forEach(k => this._selectedCloudExplorerKeys.add(k));
          } else {
            visibleKeys.forEach(k => this._selectedCloudExplorerKeys.delete(k));
          }
          this.renderMyLibraryList();
        };
      }
      window.addEventListener('pointerdown', (e) => {
        if (moveMenuEl && moveMenuEl.style.display !== 'none') {
          if (!moveMenuEl.contains(e.target) && (!btnActionMove || !btnActionMove.contains(e.target))) {
            moveMenuEl.style.display = 'none';
          }
        }
      });

      if (btnNavUp) {
        btnNavUp.onclick = () => {
          if (typeof this.closeCloudItemSharePopover === 'function') {
            this.closeCloudItemSharePopover();
          }
          const cur = String(this._activeCloudFolder || '').trim();
          if (!cur || cur === '__ALL_RECENT__' || cur === '__UNCATEGORIZED__') {
            this._activeCloudFolder = '';
          } else if (cur.includes('/')) {
            this._activeCloudFolder = cur.split('/').slice(0, -1).join('/');
          } else {
            this._activeCloudFolder = '';
          }
          this._selectedCloudExplorerKeys.clear();
          this.syncExportCloudFolderSelect();
          this.renderMyLibraryList();
        };
      }

      if (btnAddRootFolder) {
        btnAddRootFolder.onclick = () => {
          const cur = String(this._activeCloudFolder || '').trim();
          const targetParent = (!cur || cur === '__ALL_RECENT__' || cur === '__UNCATEGORIZED__') ? '' : cur;
          this.openNewCloudFolderInput(targetParent);
        };
      }

      const btnUploadLocalFiles = document.getElementById('btnCloudUploadLocalFiles');
      const inpUploadLocalFiles = document.getElementById('inputCloudUploadLocalFiles');
      if (btnUploadLocalFiles && inpUploadLocalFiles) {
        btnUploadLocalFiles.onclick = () => {
          if (!this.cloudUser || !this.cloudUser.uid) {
            this.promptCloudLoginForLibrary('🔒 내 기기의 파일을 클라우드 보관함에 올리려면 먼저 로그인해 주세요.');
            return;
          }
          if (typeof this._syncGraphlyFileInputAcceptForDevice === 'function') {
            this._syncGraphlyFileInputAcceptForDevice(inpUploadLocalFiles, '.graphly');
          }
          inpUploadLocalFiles.value = '';
          inpUploadLocalFiles.click();
        };
        inpUploadLocalFiles.onchange = async (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            await this.uploadLocalGraphlyFilesToCloud(files);
          }
          inpUploadLocalFiles.value = '';
        };
      }

      if (inpLibSearch) {
        inpLibSearch.oninput = (e) => {
          if (typeof this.closeCloudItemSharePopover === 'function') {
            this.closeCloudItemSharePopover();
          }
          this._cloudLibrarySearchQuery = String(e.target.value || '').trim();
          this.renderMyLibraryList();
        };
      }
      const submitNewCloudFolder = () => {
        if (!inpNewFolder) return;
        const folderName = String(inpNewFolder.value || '').trim();
        if (!folderName) {
          this.showToast('📁 생성할 폴더 이름을 입력해 주세요.');
          inpNewFolder.focus();
          return;
        }
        this.addCloudFolder(folderName, this._newFolderParentPath || '');
        inpNewFolder.value = '';
        this._newFolderParentPath = '';
        if (rowNewFolder) rowNewFolder.style.display = 'none';
      };
      if (btnConfirmFolder) {
        btnConfirmFolder.onclick = () => submitNewCloudFolder();
      }
      if (btnCancelFolder) {
        btnCancelFolder.onclick = () => {
          if (inpNewFolder) inpNewFolder.value = '';
          this._newFolderParentPath = '';
          if (rowNewFolder) rowNewFolder.style.display = 'none';
        };
      }
      if (inpNewFolder) {
        inpNewFolder.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitNewCloudFolder();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            inpNewFolder.value = '';
            this._newFolderParentPath = '';
            if (rowNewFolder) rowNewFolder.style.display = 'none';
          }
        };
      }
      if (btnProGoLogin) {
        btnProGoLogin.onclick = () => {
          const modalProEl = document.getElementById('modalProPricing');
          if (modalProEl) modalProEl.classList.remove('show');
          this.promptCloudLoginForLibrary('🔑 로그인 또는 회원가입 후 결제를 진행해 주세요.');
        };
      }
      const btnOpenProHub = document.getElementById('btnOpenProPricingFromHub');
      const btnCloudQuotaUpgrade = document.getElementById('btnCloudQuotaUpgrade');
      const btnOpenProSettings = document.getElementById('btnOpenProPricingFromSettings');
      const modalPro = document.getElementById('modalProPricing');
      const btnClosePro = document.getElementById('btnCloseProPricingModal');
      const btnPayNow = document.getElementById('btnProModalPayNow');
      const btnCycleMonthly = document.getElementById('btnBillingCycleMonthly');
      const btnCycleYearly = document.getElementById('btnBillingCycleYearly');
      const btnProCycleMonthly = document.getElementById('btnProCycleMonthly');
      const btnProCycleYearly = document.getElementById('btnProCycleYearly');
      const btnPremiumCycleMonthly = document.getElementById('btnPremiumCycleMonthly');
      const btnPremiumCycleYearly = document.getElementById('btnPremiumCycleYearly');
      const cardPlanPro = document.getElementById('cardPlanPro');
      const cardPlanPremium = document.getElementById('cardPlanPremium');
      const cardPro1M = document.getElementById('cardPlanPro1M');
      const cardPro1Y = document.getElementById('cardPlanPro1Y');

      this._tierBillingCycles = { pro: 'monthly', premium: 'monthly' };
      this._selectedPricingTier = 'pro';
      this._selectedBillingCycle = 'monthly';
      this._lastAppliedBillingCycle = 'monthly';
      if (typeof this.syncProPricingModalUI === 'function') {
        this.syncProPricingModalUI();
      }

      const selectCardAndCycle = (tier, cycle = '') => {
        const targetTier = (tier === 'premium') ? 'premium' : 'pro';
        if (!this._tierBillingCycles) {
          this._tierBillingCycles = { pro: 'monthly', premium: 'monthly' };
        }
        if (cycle === 'monthly' || cycle === 'yearly') {
          this._tierBillingCycles[targetTier] = cycle;
        }
        const resolvedCycle = (this._tierBillingCycles[targetTier] === 'yearly') ? 'yearly' : 'monthly';
        this._selectedPricingTier = targetTier;
        this._selectedBillingCycle = resolvedCycle;
        this._lastAppliedBillingCycle = resolvedCycle;
        this.syncProPricingModalUI();
      };

      if (btnProCycleMonthly) {
        btnProCycleMonthly.onclick = (e) => {
          if (e) e.stopPropagation();
          selectCardAndCycle('pro', 'monthly');
        };
      }
      if (btnProCycleYearly) {
        btnProCycleYearly.onclick = (e) => {
          if (e) e.stopPropagation();
          selectCardAndCycle('pro', 'yearly');
        };
      }
      if (btnPremiumCycleMonthly) {
        btnPremiumCycleMonthly.onclick = (e) => {
          if (e) e.stopPropagation();
          selectCardAndCycle('premium', 'monthly');
        };
      }
      if (btnPremiumCycleYearly) {
        btnPremiumCycleYearly.onclick = (e) => {
          if (e) e.stopPropagation();
          selectCardAndCycle('premium', 'yearly');
        };
      }
      if (btnCycleMonthly) {
        btnCycleMonthly.onclick = () => selectCardAndCycle(this._selectedPricingTier, 'monthly');
      }
      if (btnCycleYearly) {
        btnCycleYearly.onclick = () => selectCardAndCycle(this._selectedPricingTier, 'yearly');
      }
      if (cardPlanPro) {
        cardPlanPro.onclick = () => selectCardAndCycle('pro');
      }
      if (cardPlanPremium) {
        cardPlanPremium.onclick = () => selectCardAndCycle('premium');
      }
      if (cardPro1M) {
        cardPro1M.onclick = () => selectCardAndCycle('pro', 'monthly');
      }
      if (cardPro1Y) {
        cardPro1Y.onclick = () => selectCardAndCycle('pro', 'yearly');
      }
      if (modalPro) {
        modalPro.addEventListener('click', (e) => {
          if (e.target === modalPro) modalPro.classList.remove('show');
        });
      }
      if (btnOpenProHub) {
        btnOpenProHub.onclick = () => {
          if (modalCloud) modalCloud.classList.remove('show');
          this.openProPricingModal();
        };
      }
      if (btnCloudQuotaUpgrade) {
        btnCloudQuotaUpgrade.onclick = () => {
          const curTier = this.getUserSubscriptionTier();
          if (modalCloud) modalCloud.classList.remove('show');
          this.openProPricingModal(curTier === 'pro' ? 'premium' : 'pro');
        };
      }
      if (btnOpenProSettings) {
        btnOpenProSettings.onclick = () => this.openProPricingModal();
      }
      this.initPromoBannerModalEvents();
      this.initCloudShareOptionPopoverEvents();
      const btnOpenGuideSettings = document.getElementById('btnOpenGuideNoticeFromSettings');
      const btnBugReportSettings = document.getElementById('btnBugReportFromSettings');
      const modalGuide = document.getElementById('modalGuideNotice');
      const btnCloseGuide = document.getElementById('btnCloseGuideNoticeModal');
      const btnCopySupportEmail = document.getElementById('btnCopySupportEmail');
      const tabBtnHowTo = document.getElementById('tabBtnGuideHowTo');
      const tabBtnShortcuts = document.getElementById('tabBtnGuideShortcuts');
      const tabBtnNotices = document.getElementById('tabBtnGuideNotices');
      const panelHowTo = document.getElementById('guidePanelHowTo');
      const panelShortcuts = document.getElementById('guidePanelShortcuts');
      const panelNotices = document.getElementById('guidePanelNotices');

      const switchGuideTab = (tabKey) => {
        if (tabBtnHowTo) tabBtnHowTo.classList.toggle('active', tabKey === 'howto');
        if (tabBtnShortcuts) tabBtnShortcuts.classList.toggle('active', tabKey === 'shortcuts');
        if (tabBtnNotices) tabBtnNotices.classList.toggle('active', tabKey === 'notices');
        if (panelHowTo) panelHowTo.style.display = (tabKey === 'howto') ? 'block' : 'none';
        if (panelShortcuts) panelShortcuts.style.display = (tabKey === 'shortcuts') ? 'block' : 'none';
        if (panelNotices) panelNotices.style.display = (tabKey === 'notices') ? 'block' : 'none';
      };
      this.openGuideNoticeModal = (defaultTab = 'howto') => {
        if (!modalGuide) return;
        switchGuideTab(defaultTab);
        modalGuide.classList.add('show');
      };
      if (btnOpenGuideSettings) {
        btnOpenGuideSettings.onclick = () => this.openGuideNoticeModal('howto');
      }
      if (tabBtnHowTo) tabBtnHowTo.onclick = () => switchGuideTab('howto');
      if (tabBtnShortcuts) tabBtnShortcuts.onclick = () => switchGuideTab('shortcuts');
      if (tabBtnNotices) tabBtnNotices.onclick = () => switchGuideTab('notices');
      if (btnCloseGuide && modalGuide) {
        btnCloseGuide.onclick = () => modalGuide.classList.remove('show');
      }
      const copySupportEmailWithToast = () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('help@cubiolab.com').catch(() => { });
          }
        } catch (err) { }
        this.showToast('📋 help@cubiolab.com 이메일 주소가 복사되었습니다!');
      };
      if (btnCopySupportEmail) {
        btnCopySupportEmail.onclick = () => copySupportEmailWithToast();
      }
      if (btnBugReportSettings) {
        btnBugReportSettings.addEventListener('click', () => {
          copySupportEmailWithToast();
        });
      }
      if (btnClosePro && modalPro) {
        btnClosePro.onclick = () => modalPro.classList.remove('show');
      }
      if (btnPayNow) {
        btnPayNow.onclick = () => this.requestTossPaymentFromStudio();
      }
      if (btnSaveLib) {
        btnSaveLib.onclick = () => this.saveCurrentToMyLibrary();
      }

      if (chkAll) {
        chkAll.onchange = () => {
          const boxes = document.querySelectorAll('#myLibraryList .cloud-item-chk');
          boxes.forEach(b => { b.checked = chkAll.checked; });
          this.updateSelectedPlaylistCount();
        };
      }

      if (btnStartPlaylist) {
        btnStartPlaylist.onclick = () => this.startPlaylistFromSelectedLibraryItems();
      }

      const btnOpenLocalHub = document.getElementById('btnOpenLocalFileFromHub');
      if (btnOpenLocalHub) {
        btnOpenLocalHub.onclick = () => {
          this._isReplacingViaNextCrop = false;
          if (this.triggerLocalFileExplorer) {
            this.triggerLocalFileExplorer();
          } else {
            const fi = document.getElementById('pdfFileInput');
            if (fi) { fi.value = ''; fi.click(); }
          }
        };
      }

      const btnBundleFile = document.getElementById('btnBundleSelectedToFile');
      const btnExportFile = document.getElementById('btnExportGraphlyFile');
      const btnImportFile = document.getElementById('btnImportGraphlyFile');
      const inpImportFile = document.getElementById('inputImportGraphlyFile');

      if (btnBundleFile) {
        btnBundleFile.onclick = () => this.bundleSelectedLibraryItemsToFile();
      }
      if (btnExportFile) {
        btnExportFile.onclick = () => {
          const inpTitle = document.getElementById('inputCloudSaveTitle');
          const inpTags = document.getElementById('inputCloudSaveTags');
          const slides = (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0)
            ? (this.saveCurrentSlideIntoPlaylist(), JSON.parse(JSON.stringify(this.lessonPlaylistSlides)))
            : [this.serializeFullSlideState((inpTitle && inpTitle.value.trim()) || '수업 노트')];
          const defaultTitle = slides.length > 1
            ? `Graphly_${slides.length}문항_통째수업세트`
            : (slides[0].slideTitle || 'Graphly_수업노트');
          const rawTitle = (inpTitle && inpTitle.value.trim()) ? inpTitle.value.trim() : defaultTitle;
          const rawTags = (inpTags && inpTags.value.trim()) ? inpTags.value.trim() : '#통째수업';
          this.exportGraphlyDeckFile(rawTitle, rawTags, slides);
        };
      }
      if (btnImportFile && inpImportFile) {
        btnImportFile.addEventListener('pointerenter', () => {
          if (typeof this._prewarmDefaultCursorOnButtonHover === 'function') this._prewarmDefaultCursorOnButtonHover();
        });
        btnImportFile.addEventListener('pointerdown', () => {
          if (typeof this._prewarmDefaultCursorOnButtonHover === 'function') this._prewarmDefaultCursorOnButtonHover();
        });
        btnImportFile.onclick = () => {
          this.isWaitingForFilePicker = true;
          this._filePickerOpenedAt = performance.now();
          if (typeof this._restoreDefaultCursorForFilePicker === 'function') {
            this._restoreDefaultCursorForFilePicker();
          }
          if (typeof this._syncGraphlyFileInputAcceptForDevice === 'function') {
            this._syncGraphlyFileInputAcceptForDevice(inpImportFile, '.graphly');
          }
          inpImportFile.value = '';
          inpImportFile.click();
        };
        inpImportFile.addEventListener('cancel', () => {
          if (typeof this._finishWaitingForFilePicker === 'function') {
            this._finishWaitingForFilePicker();
          }
        });
        inpImportFile.onchange = (e) => {
          if (typeof this._finishWaitingForFilePicker === 'function') {
            this._finishWaitingForFilePicker();
          } else {
            this.isWaitingForFilePicker = false;
          }
          const file = e.target.files && e.target.files[0];
          if (file) this.importGraphlyDeckFile(file);
        };
      }

      // 화면에 .graphly 파일을 드래그 앤 드롭해도 0.1초 만에 즉시 열리도록 지원! (단, 클라우드 보관함 창이 열려 있을 때는 클라우드 폴더 업로드가 처리)
      if (!this._graphlyDropListenerAttached) {
        this._graphlyDropListenerAttached = true;
        window.addEventListener('drop', (e) => {
          const modalCloud = document.getElementById('modalCloudHub');
          if (modalCloud && modalCloud.classList.contains('show')) return;
          if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
          const files = Array.from(e.dataTransfer.files);
          const graphlyFile = files.find(f => f && this._isGraphlyFileName(f.name));
          if (graphlyFile) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof this._resetPdfDropOverlayState === 'function') {
              this._resetPdfDropOverlayState();
            } else {
              const dropOverlay = document.getElementById('pdfDropOverlay');
              if (dropOverlay) dropOverlay.style.display = 'none';
            }
            if (this.isPdfModalOpen && typeof this.closePdfModal === 'function') {
              this.closePdfModal();
            }
            this.importGraphlyDeckFile(graphlyFile);
          }
        }, true);
      }

      // 수업 슬라이드(캔버스 묶음) 상단 초슬림 바 바인딩
      const btnPrev = document.getElementById('btnPlaylistPrev');
      const btnNext = document.getElementById('btnPlaylistNext');
      const btnInfo = document.getElementById('btnPlaylistSlideInfo');
      const btnAddSlide = document.getElementById('btnPlaylistAddSlide');
      const btnNextPdfPage = document.getElementById('btnPlaylistNextPdfPage');
      const btnPlaylistOpenPdf = document.getElementById('btnPlaylistOpenPdf');
      const btnToggleSelectMode = document.getElementById('btnPlaylistToggleSelectMode');
      const btnConfirmSelectedDel = document.getElementById('btnPlaylistConfirmSelectedDelete');
      const btnClearAllSlides = document.getElementById('btnPlaylistClearAll');
      const btnHidePlaylistBar = document.getElementById('btnPlaylistHideBar');
      const btnClosePlaylist = document.getElementById('btnPlaylistClose');
      const btnMiniTab = document.getElementById('topSlideBarMiniTab');

      if (btnNextPdfPage) {
        btnNextPdfPage.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this.appendNextPdfPageSlide();
        };
      }

      if (btnPlaylistOpenPdf) {
        btnPlaylistOpenPdf.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          const autoNextSlide = this.hasAnyWorkspaceContent();
          this.resumeOrOpenCurrentPdf(autoNextSlide, { startInPanMode: true });
        };
      }

      const btnPlaylistDelCur = document.getElementById('btnPlaylistDeleteCurrent');
      if (btnPrev) btnPrev.onclick = () => this.stepLessonPlaylist(-1);
      if (btnNext) btnNext.onclick = () => this.stepLessonPlaylist(1);
      if (btnInfo) {
        btnInfo.onclick = (e) => {
          e.stopPropagation();
          this.toggleSlideGridPopover();
        };
      }
      if (btnPlaylistDelCur) {
        btnPlaylistDelCur.onclick = (e) => {
          e.stopPropagation();
          this.deletePlaylistSlideAt(this.lessonPlaylistIndex);
        };
      }
      if (btnAddSlide) {
        btnAddSlide.onclick = (e) => this.handleSmartAddSlideFromTopBar(e);
      }
      const btnMenuNextPdfPage = document.getElementById('btnAddSlideMenuNextPdfPage');
      const btnMenuPickPdf = document.getElementById('btnAddSlideMenuPickPdf');
      const btnMenuBlankCanvas = document.getElementById('btnAddSlideMenuBlankCanvas');
      if (btnMenuNextPdfPage) {
        btnMenuNextPdfPage.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this._isAddSlideMenuOpen = false;
          this.syncLessonPlaylistNavBarUI();
          this.appendNextPdfPageSlide();
        };
      }
      if (btnMenuPickPdf) {
        btnMenuPickPdf.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this._isAddSlideMenuOpen = false;
          this.syncLessonPlaylistNavBarUI();
          const autoNextSlide = this.hasAnyWorkspaceContent();
          this.resumeOrOpenCurrentPdf(autoNextSlide, { startInPanMode: true });
        };
      }
      if (btnMenuBlankCanvas) {
        btnMenuBlankCanvas.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this._isAddSlideMenuOpen = false;
          this.syncLessonPlaylistNavBarUI();
          this.handleNewCanvasButtonClick();
        };
      }
      if (btnToggleSelectMode) {
        btnToggleSelectMode.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this.toggleSlideSelectDeleteMode();
        };
      }
      if (btnConfirmSelectedDel) {
        btnConfirmSelectedDel.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this.deleteSelectedPlaylistSlides();
        };
      }
      if (btnClearAllSlides) {
        btnClearAllSlides.onclick = (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this._isSlideGridOpen = false;
          this._isSlideSelectDeleteMode = false;
          this._selectedSlideDeleteIndices = new Set();
          this.clearAllSlidesAndReset();
        };
      }
      if (btnHidePlaylistBar) {
        btnHidePlaylistBar.onclick = () => this.toggleTopSlideBarHidden(false);
      }
      if (btnMiniTab) {
        btnMiniTab.onclick = () => this.toggleTopSlideBarHidden(false);
      }
      if (btnClosePlaylist) {
        btnClosePlaylist.onclick = () => this.closeLessonPlaylistMode();
      }
      this.initAccidentalRefreshProtection();
    }

    openCloudHubModal(options = null) {
      const modalCloud = document.getElementById('modalCloudHub');
      if (!modalCloud) return;
      if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
        this.closeDrawer();
      }
      if (!(options && options.fromExportModal)) {
        this._returnToShareModalAfterCloudSave = false;
        this._pendingExportCloudFilter = null;
      }
      if (this.isLessonPlaylistActive) {
        this.saveCurrentSlideIntoPlaylist();
      }
      if (this._selectedCloudExplorerKeys) {
        this._selectedCloudExplorerKeys.clear();
      }
      if (typeof this.closeCloudItemSharePopover === 'function') {
        this.closeCloudItemSharePopover();
      }
      const moveMenuEl = document.getElementById('cloudMoveDropdownMenu');
      if (moveMenuEl) moveMenuEl.style.display = 'none';
      const chkAll = document.getElementById('chkCloudSelectAll');
      if (chkAll) chkAll.checked = false;
      const rowNewFolder = document.getElementById('cloudNewFolderInlineRow');
      if (rowNewFolder) rowNewFolder.style.display = 'none';
      if (typeof this._syncCloudExplorerScopeUI === 'function') {
        this._syncCloudExplorerScopeUI();
      }
      const inpCloudTitle = document.getElementById('inputCloudSaveTitle');
      const inpShareTitle = document.getElementById('inputShareModalDeckTitle');
      const loadedMeta = (this._activeLoadedCloudLibraryMeta && this._activeLoadedCloudLibraryMeta.title)
        ? this._activeLoadedCloudLibraryMeta
        : null;
      const prefillTitle = (options && typeof options.prefillTitle === 'string' && options.prefillTitle.trim())
        ? options.prefillTitle.trim()
        : ((inpShareTitle && inpShareTitle.value.trim())
          ? inpShareTitle.value.trim()
          : (loadedMeta ? String(loadedMeta.title).trim() : ''));
      if (loadedMeta && loadedMeta.folder !== undefined && !(options && options.keepCurrentFolder)) {
        const targetFolder = String(loadedMeta.folder || '').trim();
        const allFolders = this.getCloudFoldersList();
        if (!targetFolder || allFolders.includes(targetFolder)) {
          this._activeCloudFolder = targetFolder;
        }
      }
      if (inpCloudTitle && prefillTitle) {
        inpCloudTitle.value = prefillTitle;
      }
      modalCloud.classList.add('show');
      this.syncCloudAuthUI();
      this.renderMyLibraryList();
      if (inpCloudTitle && prefillTitle) {
        inpCloudTitle.value = prefillTitle;
      }
      this.verifyActiveDeviceSessionLock().then((valid) => {
        if (valid) this.fetchMyLibraryFromCloud();
      });
    }

    openNewCloudFolderInput(parentPath = '') {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.promptCloudLoginForLibrary('🔒 폴더 관리는 로그인 후 이용할 수 있습니다.');
        return;
      }
      const rowNewFolder = document.getElementById('cloudNewFolderInlineRow');
      const lblTarget = document.getElementById('lblNewCloudFolderTarget');
      const inpNewFolder = document.getElementById('inputNewCloudFolderName');
      if (!rowNewFolder) return;

      this._newFolderParentPath = String(parentPath || '').trim();
      if (lblTarget) {
        const parentShort = this._newFolderParentPath
          ? this._cleanCloudFolderDisplayLabel(this._newFolderParentPath.split('/').pop())
          : '내 클라우드';
        lblTarget.textContent = parentShort;
        lblTarget.title = `${parentShort} 안에 새 폴더 생성`;
      }
      if (inpNewFolder) {
        inpNewFolder.placeholder = '새 폴더 이름 입력 후 Enter';
        inpNewFolder.value = '';
      }
      rowNewFolder.style.display = 'flex';
      if (inpNewFolder) {
        setTimeout(() => inpNewFolder.focus(), 30);
      }
    }

    _getCloudFoldersStorageKey() {
      if (!this.cloudUser || !this.cloudUser.uid) return null;
      return `graphly_cloud_folders_v1_${this.cloudUser.uid}`;
    }

    getCloudFoldersList() {
      if (!this.cloudUser || !this.cloudUser.uid) return [];
      const folderSet = new Set();
      const addWithParents = (rawPath) => {
        const clean = String(rawPath || '').trim().replace(/^\/+|\/+$/g, '');
        if (!clean) return;
        const parts = clean.split('/').map(s => s.trim()).filter(Boolean);
        let accum = '';
        for (let i = 0; i < parts.length; i++) {
          accum = accum ? `${accum}/${parts[i]}` : parts[i];
          folderSet.add(accum);
        }
      };
      try {
        const key = this._getCloudFoldersStorageKey();
        const saved = key ? localStorage.getItem(key) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach(f => addWithParents(f));
          }
        }
      } catch (e) { }
      if (Array.isArray(this.myLibraryCache)) {
        this.myLibraryCache.forEach(it => {
          if (it && this._isOwnedByCurrentCloudUser(it)) {
            addWithParents(it.folder);
          }
        });
      }
      return Array.from(folderSet);
    }

    _saveCloudFoldersList(folders, syncToCloud = true) {
      if (!this.cloudUser || !this.cloudUser.uid) return;
      const unique = Array.from(new Set((folders || []).map(f => String(f || '').trim().replace(/^\/+|\/+$/g, '')).filter(Boolean)));
      try {
        const key = this._getCloudFoldersStorageKey();
        if (key) {
          localStorage.setItem(key, JSON.stringify(unique));
        }
      } catch (e) { }
      if (syncToCloud && typeof this._firestoreRestWriteSingleDoc === 'function') {
        const docId = `folders_${this.cloudUser.uid}`;
        const payload = JSON.stringify({
          uid: this.cloudUser.uid,
          folders: unique,
          updatedAt: Date.now()
        });
        this._firestoreRestWriteSingleDoc('user_preferences', docId, payload).catch(() => { });
      }
    }

    async _persistCloudItemMetadataChange(item) {
      if (!item || !item.id) return;
      if (this._activeLoadedCloudLibraryMeta && this._activeLoadedCloudLibraryMeta.id === item.id) {
        this._activeLoadedCloudLibraryMeta = {
          ...this._activeLoadedCloudLibraryMeta,
          title: String(item.title || '').trim(),
          folder: String(item.folder || '').trim(),
          tags: String(item.tags || '').trim()
        };
      }
      try {
        const localKey = 'graphly_full_doc_' + item.id;
        const localRaw = (typeof this._idbCacheGet === 'function' ? await this._idbCacheGet(localKey) : null) || localStorage.getItem(localKey);
        if (localRaw) {
          const uncomp = typeof localRaw === 'string' ? await this._decompressJsonStringGzipBase64(localRaw) : JSON.stringify(localRaw);
          const parsed = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
          if (parsed && typeof parsed === 'object') {
            parsed.title = item.title;
            parsed.folder = item.folder || '';
            parsed.tags = item.tags || '';
            parsed.updatedAt = Date.now();
            if (typeof this._idbCacheSet === 'function') {
              const compUpdated = await this._compressJsonStringGzipBase64(JSON.stringify(parsed));
              await this._idbCacheSet(localKey, compUpdated);
            }
          }
        }
      } catch (e) { }
      try {
        const isManifestOnly = Boolean(
          item._isVaultLayered ||
          item.linkedShareId ||
          item._tempShareId ||
          (item._shareLinksMap && typeof item._shareLinksMap === 'object' && Object.keys(item._shareLinksMap).length > 0) ||
          (item._isChunked && item._chunkCount && item._chunkDocPrefix)
        );
        if (isManifestOnly) {
          item.updatedAt = Date.now();
          const manifestObj = {
            ...item,
            slideData: null,
            playlistSlides: null,
            updatedAt: item.updatedAt
          };
          await this._firestoreRestWriteSingleDoc('user_library', item.id, JSON.stringify(manifestObj));
        } else {
          item.updatedAt = Date.now();
          await this._firestoreRestWrite('user_library', item.id, item);
        }
      } catch (e) { }
    }

    // 같은 폴더 안에 동일한 이름(대소문자/앞뒤공백 무시)의 파일이 이미 존재하는지 검사
    _findDuplicateCloudItem(title, folderPath = '', excludeId = null) {
      const normTitle = String(title || '').trim().toLowerCase();
      const normFolder = String(folderPath || '').trim();
      if (!normTitle || !Array.isArray(this.myLibraryCache)) return null;
      return this.myLibraryCache.find(it => {
        if (!it || !this._isOwnedByCurrentCloudUser(it)) return false;
        if (excludeId && it.id === excludeId) return false;
        const itFolder = String(it.folder || '').trim();
        const itTitle = String(it.title || '').trim().toLowerCase();
        return itFolder === normFolder && itTitle === normTitle;
      }) || null;
    }

    // 같은 폴더 안에서 사용 가능한 다음 번호 이름 생성 — 예: "파일명 (2)", "파일명 (3)"
    _getNextAvailableCloudTitle(baseTitle, folderPath = '', excludeId = null) {
      const cleanBase = String(baseTitle || '수업 노트').trim().replace(/\s*\(\d+\)$/, '').trim() || '수업 노트';
      if (!this._findDuplicateCloudItem(cleanBase, folderPath, excludeId)) {
        return cleanBase;
      }
      let n = 2;
      while (n < 1000) {
        const candidate = `${cleanBase} (${n})`;
        if (!this._findDuplicateCloudItem(candidate, folderPath, excludeId)) {
          return candidate;
        }
        n++;
      }
      return `${cleanBase} (${Date.now().toString().slice(-4)})`;
    }

    async _cleanupCloudItemChunks(item) {
      if (!item) return;
      const primaryCol = item._chunkCollection || 'shared_workspaces';
      try {
        const tasks = [];
        if (item._isChunked && item._chunkCount && item._chunkDocPrefix) {
          for (let i = 0; i < item._chunkCount; i++) {
            const cId = `${item._chunkDocPrefix}${i}`;
            tasks.push(this._firestoreRestDeleteDoc(primaryCol, cId).catch(() => { }));
            if (primaryCol !== 'shared_workspaces') {
              tasks.push(this._firestoreRestDeleteDoc('shared_workspaces', cId).catch(() => { }));
            }
          }
        }
        if (item._hasLazyAudio && item._audioChunkCount && item._audioChunkPrefix) {
          const audioCol = item._audioChunkCollection || primaryCol || 'shared_workspaces';
          for (let i = 0; i < item._audioChunkCount; i++) {
            tasks.push(this._firestoreRestDeleteDoc(audioCol, `${item._audioChunkPrefix}${i}`).catch(() => { }));
          }
        }
        await Promise.all(tasks);
      } catch (e) { }
    }

    async _deleteCloudLibraryItemCompletely(item) {
      if (!item || !item.id) return;
      if (this._activeCloudSharePopoverItemId === item.id && typeof this.closeCloudItemSharePopover === 'function') {
        this.closeCloudItemSharePopover();
      }
      if (this._activeLoadedCloudLibraryMeta && this._activeLoadedCloudLibraryMeta.id === item.id) {
        this._activeLoadedCloudLibraryMeta = null;
      }
      if (Array.isArray(this.myLibraryCache)) {
        this.myLibraryCache = this.myLibraryCache.filter(x => x && x.id !== item.id);
      }
      try {
        localStorage.removeItem('graphly_full_doc_' + item.id);
      } catch (e) { }
      if (typeof this._idbCacheDelete === 'function') {
        await this._idbCacheDelete('graphly_full_doc_' + item.id).catch(() => { });
      }
      const shareIdsToPurge = new Set();
      if (item.linkedShareId) shareIdsToPurge.add(String(item.linkedShareId));
      if (item._tempShareId) shareIdsToPurge.add(String(item._tempShareId));
      if (item._shareLinksMap && typeof item._shareLinksMap === 'object') {
        Object.values(item._shareLinksMap).forEach((entry) => {
          if (entry && entry.shortId) {
            shareIdsToPurge.add(String(entry.shortId));
          }
        });
      }
      if (shareIdsToPurge.size > 0) {
        const shareCleanupTasks = [];
        shareIdsToPurge.forEach((shareId) => {
          if (!shareId) return;
          if (this._activeSessionShareShortId === shareId) {
            this._activeSessionShareShortId = '';
            this._lastShareNoteSessionKey = '';
            this._lastShareContentSig = '';
            this._lastSessionShareManifestMeta = null;
          }
          try { localStorage.removeItem('graphly_cloud_share_' + shareId); } catch (e) { }
          try { localStorage.removeItem('graphly_full_doc_' + shareId); } catch (e) { }
          if (typeof this._idbCacheDelete === 'function') {
            shareCleanupTasks.push(this._idbCacheDelete('graphly_cloud_share_' + shareId).catch(() => { }));
            shareCleanupTasks.push(this._idbCacheDelete('graphly_full_doc_' + shareId).catch(() => { }));
          }
          shareCleanupTasks.push(this._firestoreRestDeleteDoc('shared_workspaces', shareId).catch(() => { }));
        });
        await Promise.all(shareCleanupTasks);
      }
      if (item.vaultKeys && typeof this._deleteCloudVaultLayersFromServer === 'function') {
        await this._deleteCloudVaultLayersFromServer(item).catch(() => { });
      }
      await this._cleanupCloudItemChunks(item);
      try {
        await this._firestoreRestDeleteDoc('user_library', item.id);
      } catch (e) { }
    }

    // 🪟 윈도우 탐색기 표준: 같은 폴더 내 동일 파일명 충돌 시 [🔄 덮어쓰기] / [➕ 파일명 (2)로 저장] / [취소] 선택 모달
    promptCloudDuplicateResolution(title, folderPath = '', nextTitle = '', remainingCount = 0) {
      return new Promise((resolve) => {
        const existingModal = document.getElementById('modalCloudDupResolve');
        if (existingModal && existingModal.parentNode) {
          existingModal.parentNode.removeChild(existingModal);
        }
        const safeTitle = String(title || '파일')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const computedNext = nextTitle || this._getNextAvailableCloudTitle(title, folderPath);
        const safeNextTitle = String(computedNext)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const folderLabel = folderPath
          ? `📁 ${String(folderPath).replace(/\//g, ' › ')}`
          : '☁️ 내 클라우드';
        const safeFolderLabel = folderLabel
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        const backdrop = document.createElement('div');
        backdrop.id = 'modalCloudDupResolve';
        backdrop.className = 'cloud-dup-modal-backdrop';
        backdrop.innerHTML = `
        <div class="cloud-dup-modal-card" role="dialog" aria-modal="true">
          <div class="cloud-dup-modal-title">
            <span>⚠️ 같은 이름의 파일이 이미 있습니다</span>
          </div>
          <div class="cloud-dup-modal-desc">
            <strong>[${safeFolderLabel}]</strong> 폴더에 이미 <strong>"${safeTitle}"</strong> 파일이 있습니다.<br>어떻게 처리할까요?
          </div>
          <div class="cloud-dup-modal-actions">
            <button type="button" class="cloud-dup-choice-btn is-overwrite" data-dup-act="overwrite">
              <span class="cloud-dup-choice-main">🔄 덮어쓰기 (기존 파일 교체)</span>
              <span class="cloud-dup-choice-sub">기존 파일을 지우고 지금 파일로 업데이트합니다</span>
            </button>
            <button type="button" class="cloud-dup-choice-btn" data-dup-act="rename">
              <span class="cloud-dup-choice-main">➕ 새 이름으로 저장 — "${safeNextTitle}"</span>
              <span class="cloud-dup-choice-sub">이름 뒤에 번호를 붙여 두 파일을 모두 유지합니다</span>
            </button>
          </div>
          <div class="cloud-dup-modal-footer">
            ${remainingCount > 0 ? `
              <label class="cloud-dup-apply-all-label">
                <input type="checkbox" id="chkCloudDupApplyAll" checked>
                <span>나머지 중복 항목(${remainingCount}개)에도 동일하게 적용</span>
              </label>
            ` : '<span></span>'}
            <button type="button" class="cloud-dup-cancel-btn" data-dup-act="cancel">취소</button>
          </div>
        </div>
      `;

        const cleanupAndResolve = (action) => {
          window.removeEventListener('keydown', onKeyDown, true);
          const chkAll = backdrop.querySelector('#chkCloudDupApplyAll');
          const applyToAll = Boolean(chkAll && chkAll.checked);
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          resolve({ action, applyToAll });
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cleanupAndResolve('cancel');
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            cleanupAndResolve('overwrite');
          }
        };

        window.addEventListener('keydown', onKeyDown, true);
        backdrop.querySelectorAll('[data-dup-act]').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            cleanupAndResolve(btn.getAttribute('data-dup-act') || 'cancel');
          };
        });

        document.body.appendChild(backdrop);
        const overwriteBtn = backdrop.querySelector('[data-dup-act="overwrite"]');
        if (overwriteBtn) setTimeout(() => overwriteBtn.focus(), 20);
      });
    }

    addCloudFolder(folderName, parentPath = '') {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.promptCloudLoginForLibrary('🔒 폴더 관리는 로그인 후 이용할 수 있습니다.');
        return;
      }
      const cleanSeg = String(folderName || '').replace(/\//g, ' ').trim().slice(0, 28);
      if (!cleanSeg) return;
      const cleanParent = String(parentPath || '').trim().replace(/^\/+|\/+$/g, '');
      const fullPath = cleanParent ? `${cleanParent}/${cleanSeg}` : cleanSeg;

      const list = this.getCloudFoldersList();
      const existingFolder = list.find(f => String(f || '').trim().toLowerCase() === fullPath.toLowerCase());
      if (existingFolder) {
        this._selectedCloudExplorerKeys = new Set([`folder:${existingFolder}`]);
        this.renderMyLibraryList();
        this.showToast(`⚠️ 이미 [${cleanSeg}] 폴더가 존재합니다.`);
        return;
      }
      list.push(fullPath);
      this._saveCloudFoldersList(list);
      if (!this._collapsedCloudFolders) this._collapsedCloudFolders = new Set();
      if (cleanParent) {
        this._collapsedCloudFolders.delete(cleanParent);
      }
      // 윈도우 탐색기처럼 현재 열려있는 폴더를 유지하면서 방금 만든 새 폴더를 선택 상태로 표시
      if (this._activeCloudFolder === '__ALL_RECENT__' || this._activeCloudFolder === '__UNCATEGORIZED__') {
        this._activeCloudFolder = cleanParent || '';
      }
      this._selectedCloudExplorerKeys = new Set([`folder:${fullPath}`]);
      this.syncExportCloudFolderSelect();
      this.renderMyLibraryList();
      this.showToast(`📁 [${cleanSeg}] 폴더가 생성되었습니다. (더블클릭하여 열기)`);
    }

    async renameCloudFolder(oldPath, newSegmentName) {
      const cleanOld = String(oldPath || '').trim();
      const cleanSeg = String(newSegmentName || '').replace(/\//g, ' ').trim().slice(0, 28);
      this._renamingCloudFolderPath = null;
      if (!cleanOld || !cleanSeg) {
        this.renderMyLibraryList();
        return;
      }
      const parts = cleanOld.split('/');
      parts[parts.length - 1] = cleanSeg;
      const newPath = parts.join('/');
      if (newPath === cleanOld) {
        this.renderMyLibraryList();
        return;
      }
      const existingList = this.getCloudFoldersList();
      if (existingList.some(f => f !== cleanOld && f.toLowerCase() === newPath.toLowerCase())) {
        this.renderMyLibraryList();
        this.showToast(`⚠️ 같은 위치에 이미 [${cleanSeg}] 폴더가 있습니다.`);
        return;
      }
      const updatedFolders = this.getCloudFoldersList().map(f => {
        if (f === cleanOld) return newPath;
        if (f.startsWith(cleanOld + '/')) return newPath + f.slice(cleanOld.length);
        return f;
      });
      this._saveCloudFoldersList(updatedFolders);
      if (this._activeCloudFolder === cleanOld) {
        this._activeCloudFolder = newPath;
      } else if (String(this._activeCloudFolder || '').startsWith(cleanOld + '/')) {
        this._activeCloudFolder = newPath + String(this._activeCloudFolder).slice(cleanOld.length);
      }
      const updatedItems = [];
      if (Array.isArray(this.myLibraryCache)) {
        this.myLibraryCache.forEach(it => {
          if (!it) return;
          const curF = String(it.folder || '').trim();
          if (curF === cleanOld) {
            it.folder = newPath;
            updatedItems.push(it);
          } else if (curF.startsWith(cleanOld + '/')) {
            it.folder = newPath + curF.slice(cleanOld.length);
            updatedItems.push(it);
          }
        });
        this._saveMyLibraryCacheForCurrentUser();
      }
      this._selectedCloudExplorerKeys = new Set([`folder:${newPath}`]);
      this.syncExportCloudFolderSelect();
      this.renderMyLibraryList();
      this.showToast(`✏️ 폴더 이름이 [${cleanSeg}](으)로 변경되었습니다.`);
      for (const it of updatedItems) {
        if (it && it.id) {
          try { await this._persistCloudItemMetadataChange(it); } catch (e) { }
        }
      }
    }

    async renameCloudLibraryItem(item, newTitle) {
      if (!item) return;
      const cleanTitle = String(newTitle || '').trim();
      this._renamingCloudItemId = null;
      if (!cleanTitle || cleanTitle === item.title) {
        this.renderMyLibraryList();
        return;
      }
      const curFolder = String(item.folder || '').trim();
      const dupItem = this._findDuplicateCloudItem(cleanTitle, curFolder, item.id);
      let finalTitle = cleanTitle;
      if (dupItem) {
        const nextTitle = this._getNextAvailableCloudTitle(cleanTitle, curFolder, item.id);
        const res = await this.promptCloudDuplicateResolution(cleanTitle, curFolder, nextTitle, 0);
        if (!res || res.action === 'cancel') {
          this.renderMyLibraryList();
          return;
        }
        if (res.action === 'rename') {
          finalTitle = nextTitle;
        } else if (res.action === 'overwrite') {
          await this._deleteCloudLibraryItemCompletely(dupItem);
          finalTitle = cleanTitle;
        }
      }
      item.title = finalTitle;
      this._saveMyLibraryCacheForCurrentUser();
      this.renderMyLibraryList();
      this.showToast(`✏️ 제목이 [${finalTitle}](으)로 변경되었습니다.`);
      if (item.id) {
        try { await this._persistCloudItemMetadataChange(item); } catch (e) { }
      }
    }

    _syncCloudExplorerSelectionButtons() {
      if (!this._selectedCloudExplorerKeys) this._selectedCloudExplorerKeys = new Set();
      const cnt = this._selectedCloudExplorerKeys.size;
      const saveRow = document.getElementById('cloudFooterSaveRow');
      const actionRow = document.getElementById('cloudFooterActionRow');
      const lblCountBadge = document.getElementById('lblCloudSelectionCountBadge');
      const btnOpen = document.getElementById('btnCloudActionOpen');
      const lblFooterOpen = document.getElementById('lblCloudFooterOpenText');
      const btnDownload = document.getElementById('btnCloudActionDownload');
      const btnMove = document.getElementById('btnCloudActionMove');
      const moveMenuEl = document.getElementById('cloudMoveDropdownMenu');
      const btnDelete = document.getElementById('btnCloudActionDelete');
      const chkAll = document.getElementById('chkCloudExplorerAll');

      if (saveRow && actionRow) {
        saveRow.style.display = cnt > 0 ? 'none' : 'flex';
        actionRow.style.display = cnt > 0 ? 'flex' : 'none';
      }
      if (cnt === 0 && moveMenuEl) {
        moveMenuEl.style.display = 'none';
      }
      if (lblCountBadge) {
        lblCountBadge.textContent = `${cnt}개 선택됨`;
      }

      const fileCnt = Array.from(this._selectedCloudExplorerKeys).filter(k => k.startsWith('file:')).length;
      const folderCnt = Array.from(this._selectedCloudExplorerKeys).filter(k => k.startsWith('folder:')).length;
      const canOpen = (fileCnt > 0) || (fileCnt === 0 && folderCnt === 1);
      const openLabelText = (fileCnt > 0) ? '칠판에 열기' : '폴더 열기';
      if (btnOpen) {
        btnOpen.style.display = canOpen ? 'inline-flex' : 'none';
        btnOpen.innerHTML = `${this._getCloudVaultIconSvg('openCanvas')}<span id="lblCloudFooterOpenText">${openLabelText}</span>`;
      } else if (lblFooterOpen) {
        lblFooterOpen.textContent = openLabelText;
      }
      if (btnDownload) {
        btnDownload.style.display = fileCnt > 0 ? 'inline-flex' : 'none';
        btnDownload.innerHTML = `${this._getCloudVaultIconSvg('download')}<span>다운로드</span>`;
      }
      if (btnMove) {
        btnMove.innerHTML = `${this._getCloudVaultIconSvg('moveFolder')}<span>이동</span>${this._getCloudVaultIconSvg('chevronUp')}`;
      }
      if (btnDelete) {
        btnDelete.innerHTML = `${this._getCloudVaultIconSvg('trash')}<span>삭제</span>`;
      }
      if (chkAll) {
        const vis = Array.isArray(this._currentVisibleCloudKeys) ? this._currentVisibleCloudKeys : [];
        if (vis.length === 0) {
          chkAll.checked = false;
          chkAll.indeterminate = false;
        } else {
          const checkedVisCnt = vis.filter(k => this._selectedCloudExplorerKeys.has(k)).length;
          chkAll.checked = (checkedVisCnt === vis.length);
          chkAll.indeterminate = (checkedVisCnt > 0 && checkedVisCnt < vis.length);
        }
      }
    }

    async downloadCloudItemAsFile(item) {
      if (!item) return null;
      const resolved = await this._resolveChunkedItem(item);
      const slides = Array.isArray(resolved.playlistSlides) && resolved.playlistSlides.length > 0
        ? JSON.parse(JSON.stringify(resolved.playlistSlides))
        : (resolved.slideData ? [JSON.parse(JSON.stringify(resolved.slideData))] : []);
      if (!slides.length) {
        this.showToast('⚠️ 내려받을 파일 데이터가 없습니다.');
        return null;
      }
      const title = resolved.title || 'Graphly_수업노트';
      const tags = resolved.tags || '#수학그래프';
      const fullFilter = { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      return await this.exportGraphlyDeckFile(title, tags, slides, fullFilter);
    }

    async handleCloudExplorerDownloadSelected() {
      if (!this._selectedCloudExplorerKeys || this._selectedCloudExplorerKeys.size === 0) {
        this.showToast('💾 내 기기로 저장할 파일의 체크박스(☑)를 먼저 선택해 주세요.');
        return null;
      }
      const keys = Array.from(this._selectedCloudExplorerKeys);
      const fileIds = keys.filter(k => k.startsWith('file:')).map(k => k.slice(5));
      const selectedFiles = fileIds
        .map(id => (this.myLibraryCache || []).find(it => it && it.id === id))
        .filter(Boolean);
      if (selectedFiles.length === 0) {
        this.showToast('💾 폴더가 아닌 수업 파일을 선택해 주세요.');
        return null;
      }
      if (selectedFiles.length === 1) {
        return await this.downloadCloudItemAsFile(selectedFiles[0]);
      }
      const combinedSlides = [];
      for (const it of selectedFiles) {
        const resolved = await this._resolveChunkedItem(it);
        if (Array.isArray(resolved.playlistSlides) && resolved.playlistSlides.length > 0) {
          resolved.playlistSlides.forEach((sl, sIdx) => {
            const cloneSlide = JSON.parse(JSON.stringify(sl));
            if (!cloneSlide.slideTitle) {
              cloneSlide.slideTitle = resolved.playlistSlides.length > 1
                ? `${resolved.title || '문항'} (${sIdx + 1})`
                : (resolved.title || `문항 ${combinedSlides.length + 1}`);
            }
            combinedSlides.push(cloneSlide);
          });
        } else if (resolved.slideData) {
          const cloneSlide = JSON.parse(JSON.stringify(resolved.slideData));
          cloneSlide.slideTitle = resolved.title || cloneSlide.slideTitle || `문항 ${combinedSlides.length + 1}`;
          combinedSlides.push(cloneSlide);
        }
      }
      if (!combinedSlides.length) {
        this.showToast('⚠️ 내려받을 파일 데이터가 없습니다.');
        return null;
      }
      const bundleTitle = `${selectedFiles[0].title || 'Graphly_수업'} 외 ${selectedFiles.length - 1}건_통합세트`;
      const fullFilter = { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      return await this.exportGraphlyDeckFile(bundleTitle, '#통째수업 #풀세트', combinedSlides, fullFilter);
    }

    async handleCloudExplorerOpenSelected() {
      if (!this._selectedCloudExplorerKeys || this._selectedCloudExplorerKeys.size === 0) {
        this.showToast('📂 먼저 열려는 파일이나 폴더의 체크박스(☑)를 선택하거나 [열기] 버튼을 눌러주세요.');
        return;
      }
      const keys = Array.from(this._selectedCloudExplorerKeys);
      const folderPaths = keys.filter(k => k.startsWith('folder:')).map(k => k.slice(7));
      const fileIds = keys.filter(k => k.startsWith('file:')).map(k => k.slice(5));
      const selectedFiles = fileIds
        .map(id => (this.myLibraryCache || []).find(it => it && it.id === id))
        .filter(Boolean);

      if (selectedFiles.length === 0 && folderPaths.length > 0) {
        const targetFolder = folderPaths[0];
        this._activeCloudFolder = targetFolder;
        this._selectedCloudExplorerKeys.clear();
        if (!this._collapsedCloudFolders) this._collapsedCloudFolders = new Set();
        this._collapsedCloudFolders.delete(targetFolder);
        this.syncExportCloudFolderSelect();
        this.renderMyLibraryList();
        return;
      }

      if (selectedFiles.length === 1) {
        await this.loadCloudItemToWorkspace(selectedFiles[0], true);
        return;
      }

      if (selectedFiles.length >= 2) {
        const combinedSlides = [];
        for (const it of selectedFiles) {
          const resolved = await this._resolveChunkedItem(it);
          if (Array.isArray(resolved.playlistSlides) && resolved.playlistSlides.length > 0) {
            resolved.playlistSlides.forEach((sl, sIdx) => {
              const cloneSlide = JSON.parse(JSON.stringify(sl));
              if (!cloneSlide.slideTitle) {
                cloneSlide.slideTitle = resolved.playlistSlides.length > 1
                  ? `${resolved.title || '문항'} (${sIdx + 1})`
                  : (resolved.title || `문항 ${combinedSlides.length + 1}`);
              }
              combinedSlides.push(cloneSlide);
            });
          } else if (resolved.slideData) {
            const cloneSlide = JSON.parse(JSON.stringify(resolved.slideData));
            cloneSlide.slideTitle = resolved.title || cloneSlide.slideTitle || `문항 ${combinedSlides.length + 1}`;
            combinedSlides.push(cloneSlide);
          }
        }
        if (!combinedSlides.length) {
          this.showToast('⚠️ 불러올 캔버스 데이터가 없습니다.');
          return;
        }
        this._activeLoadedCloudLibraryMeta = null;
        this.startLessonPlaylist(combinedSlides, 0);
        const modalCloud = document.getElementById('modalCloudHub');
        if (modalCloud) modalCloud.classList.remove('show');
        const normalizedPkg = {
          id: 'lib_sel_' + Date.now().toString(36),
          title: `${selectedFiles[0].title || '수업'} 외 ${selectedFiles.length - 1}건`,
          createdAt: Date.now(),
          playlistSlides: JSON.parse(JSON.stringify(combinedSlides)),
          isPlaylist: combinedSlides.length > 1,
          currentIndex: 0
        };
        this._initialSharedCloudPkg = JSON.parse(JSON.stringify(normalizedPkg));
        await this.openSmartNoteViewer(normalizedPkg);
      }
    }

    toggleCloudExplorerMoveMenu() {
      const menuEl = document.getElementById('cloudMoveDropdownMenu');
      if (!menuEl) return;
      if (menuEl.style.display !== 'none') {
        menuEl.style.display = 'none';
        return;
      }
      if (!this._selectedCloudExplorerKeys || this._selectedCloudExplorerKeys.size === 0) {
        this.showToast('📦 이동할 파일이나 폴더의 체크박스(☑)를 먼저 선택해 주세요.');
        return;
      }

      const keys = Array.from(this._selectedCloudExplorerKeys);
      const selectedFolderPaths = keys.filter(k => k.startsWith('folder:')).map(k => k.slice(7));
      const selectedFileIds = keys.filter(k => k.startsWith('file:')).map(k => k.slice(5));
      const selectedFiles = selectedFileIds
        .map(id => (this.myLibraryCache || []).find(it => it && it.id === id))
        .filter(Boolean);

      // 선택된 각 항목들의 현재 소속 폴더 파악
      const currentParents = new Set();
      selectedFolderPaths.forEach(src => {
        const parent = src.includes('/') ? src.split('/').slice(0, -1).join('/') : '';
        currentParents.add(parent);
      });
      selectedFiles.forEach(it => {
        currentParents.add(String(it.folder || '').trim());
      });
      const isAllAlreadyInTarget = (targetPath) => (
        currentParents.size === 1 && currentParents.has(String(targetPath || '').trim())
      );

      // 선택한 폴더 자기 자신 및 그 하위 폴더는 이동 불가능하므로 목록에서 완전 제외
      const rawFolders = this.getCloudFoldersList();
      const validFoldersAfterSelfExclude = rawFolders.filter(fPath => {
        return !selectedFolderPaths.some(src => fPath === src || fPath.startsWith(src + '/'));
      });

      // 만약 어떤 폴더가 모든 선택 항목의 현재 위치(isAllAlreadyInTarget)이면서 하위 폴더도 전혀 없다면 목록에서 아예 제외
      const validFolders = validFoldersAfterSelfExclude.filter(fPath => {
        if (!isAllAlreadyInTarget(fPath)) return true;
        const hasAnyValidDescendant = validFoldersAfterSelfExclude.some(other => other.startsWith(fPath + '/'));
        return hasAnyValidDescendant;
      });

      if (!this._moveMenuCollapsedFolders) {
        this._moveMenuCollapsedFolders = new Set();
      }

      const getDirectChildren = (parentPath, folderPool) => {
        return folderPool.filter(p => {
          if (!parentPath) return !p.includes('/');
          return p.startsWith(parentPath + '/') && !p.slice(parentPath.length + 1).includes('/');
        });
      };

      const parentsWithSubs = validFolders.filter(fPath => getDirectChildren(fPath, validFolders).length > 0);
      let searchQuery = '';

      menuEl.innerHTML = `
      <div class="win-move-menu-top">
        <div class="win-move-menu-header-row">
          <div class="win-move-menu-header">이동할 대상 선택</div>
          ${parentsWithSubs.length > 0 ? `<button type="button" class="win-move-menu-fold-all-btn" id="btnMoveMenuFoldAll">하위 접기</button>` : ''}
        </div>
        <div class="win-move-menu-search-box">
          ${this._getCloudVaultIconSvg('search')}
          <input type="text" class="win-move-menu-search-input" id="inputMoveMenuFolderSearch" placeholder="이동할 폴더 검색..." autocomplete="off">
        </div>
      </div>
      <div class="win-move-menu-list" id="moveMenuFolderTreeList"></div>
    `;

      const listContainer = menuEl.querySelector('#moveMenuFolderTreeList');
      const searchInput = menuEl.querySelector('#inputMoveMenuFolderSearch');
      const btnFoldAll = menuEl.querySelector('#btnMoveMenuFoldAll');

      const syncFoldAllBtnText = () => {
        if (!btnFoldAll) return;
        const allCollapsed = parentsWithSubs.length > 0 && parentsWithSubs.every(p => this._moveMenuCollapsedFolders.has(p));
        btnFoldAll.textContent = allCollapsed ? '모두 펼치기' : '하위 접기';
      };

      const renderTree = () => {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        syncFoldAllBtnText();

        const q = String(searchQuery || '').trim().toLowerCase();
        const filteredPool = q
          ? validFolders.filter(fPath => {
            const selfMatch = fPath.toLowerCase().includes(q);
            const descMatch = validFolders.some(other => other.startsWith(fPath + '/') && other.toLowerCase().includes(q));
            return selfMatch || descMatch;
          })
          : validFolders;

        let renderedCount = 0;

        // (1) 최상위 루트 (내 클라우드): 이미 모든 선택 항목이 루트에 있는 경우가 아닐 때만 표시
        const showRootOption = !isAllAlreadyInTarget('') && (!q || '내 클라우드 최상위 홈'.includes(q));
        if (showRootOption) {
          const rootBtn = document.createElement('div');
          rootBtn.className = 'win-move-menu-item';
          rootBtn.innerHTML = `
          <div class="win-move-item-left">
            <span class="cloud-tree-icon">${this._getCloudVaultIconSvg('cloudRoot')}</span>
            <span class="cloud-tree-name">내 클라우드 (루트)</span>
          </div>
        `;
          rootBtn.onclick = (e) => {
            e.stopPropagation();
            menuEl.style.display = 'none';
            this.moveSelectedCloudItemsToFolder('');
          };
          listContainer.appendChild(rootBtn);
          renderedCount++;
        }

        // (2) 윈도우 탐색기 점선(⋮ · ├ · └) + 7px 초슬림 들여쓰기 폴더 트리 렌더링
        const renderLevel = (parentPath, ancestorContinuationFlags = []) => {
          const children = getDirectChildren(parentPath, filteredPool);
          children.forEach((fPath, idx) => {
            const isLastSibling = (idx === children.length - 1);
            const segName = fPath.split('/').pop();
            const subChildren = getDirectChildren(fPath, filteredPool);
            const hasSubs = subChildren.length > 0;
            const isCollapsed = !q && this._moveMenuCollapsedFolders.has(fPath);
            const isCurrentLoc = isAllAlreadyInTarget(fPath);

            let indentGuidesHtml = '';
            if (ancestorContinuationFlags.length > 0 || parentPath) {
              indentGuidesHtml = '<span class="cloud-tree-indent-group">';
              for (let d = 0; d < ancestorContinuationFlags.length; d++) {
                const keepVerticalLine = ancestorContinuationFlags[d];
                indentGuidesHtml += `<span class="cloud-tree-indent-guide${keepVerticalLine ? ' has-vline' : ' is-blank'}"></span>`;
              }
              indentGuidesHtml += `<span class="cloud-tree-indent-guide is-branch${isLastSibling ? ' is-last-branch' : ''}"></span>`;
              indentGuidesHtml += '</span>';
            }

            const rowEl = document.createElement('div');
            rowEl.className = 'win-move-menu-item' + (isCurrentLoc ? ' is-disabled-target' : '');
            const safeFPathTitle = this._escapeHtmlStr(this._cleanCloudFolderPathLabel(fPath));
            const safeSegName = this._escapeHtmlStr(this._cleanCloudFolderDisplayLabel(segName));
            rowEl.innerHTML = `
            <div class="win-move-item-left">
              ${indentGuidesHtml}
              <span class="cloud-tree-icon">${this._getCloudVaultIconSvg(hasSubs && !isCollapsed ? 'folderOpen' : 'folderClosed')}</span>
              <span class="cloud-tree-name" title="${safeFPathTitle}">${safeSegName}</span>
            </div>
            <div class="win-move-item-right">
              ${isCurrentLoc ? `<span class="win-move-cur-badge">현재 폴더</span>` : ''}
              ${hasSubs && !q ? `<button type="button" class="win-move-sub-toggle" title="하위 폴더 ${isCollapsed ? '펼치기' : '접기'}">${isCollapsed ? '▸' : '▾'}</button>` : ''}
            </div>
          `;

            const toggleBtn = rowEl.querySelector('.win-move-sub-toggle');
            if (toggleBtn) {
              toggleBtn.onclick = (e) => {
                e.stopPropagation();
                if (this._moveMenuCollapsedFolders.has(fPath)) {
                  this._moveMenuCollapsedFolders.delete(fPath);
                } else {
                  this._moveMenuCollapsedFolders.add(fPath);
                }
                renderTree();
              };
            }

            rowEl.onclick = (e) => {
              e.stopPropagation();
              if (isCurrentLoc) {
                if (hasSubs) {
                  if (this._moveMenuCollapsedFolders.has(fPath)) {
                    this._moveMenuCollapsedFolders.delete(fPath);
                  } else {
                    this._moveMenuCollapsedFolders.add(fPath);
                  }
                  renderTree();
                }
                return;
              }
              menuEl.style.display = 'none';
              this.moveSelectedCloudItemsToFolder(fPath);
            };

            listContainer.appendChild(rowEl);
            renderedCount++;

            if (hasSubs && !isCollapsed) {
              renderLevel(fPath, [...ancestorContinuationFlags, !isLastSibling]);
            }
          });
        };

        renderLevel('', []);

        if (renderedCount === 0) {
          listContainer.innerHTML = `<div class="win-move-menu-empty">${q ? '검색 결과가 없습니다.' : '이동할 수 있는 다른 폴더가 없습니다.'}</div>`;
        }
      };

      if (btnFoldAll) {
        btnFoldAll.onclick = (e) => {
          e.stopPropagation();
          const allCollapsed = parentsWithSubs.length > 0 && parentsWithSubs.every(p => this._moveMenuCollapsedFolders.has(p));
          if (allCollapsed) {
            parentsWithSubs.forEach(p => this._moveMenuCollapsedFolders.delete(p));
          } else {
            parentsWithSubs.forEach(p => this._moveMenuCollapsedFolders.add(p));
          }
          renderTree();
        };
      }

      if (searchInput) {
        searchInput.onclick = (e) => e.stopPropagation();
        searchInput.oninput = () => {
          searchQuery = searchInput.value || '';
          renderTree();
        };
        searchInput.onkeydown = (e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            if (searchInput.value) {
              searchInput.value = '';
              searchQuery = '';
              renderTree();
            } else {
              menuEl.style.display = 'none';
            }
          }
        };
      }

      renderTree();
      menuEl.style.display = 'flex';
    }

    async moveSelectedCloudItemsToFolder(targetFolder) {
      if (!this._selectedCloudExplorerKeys || this._selectedCloudExplorerKeys.size === 0) return;
      const cleanTarget = String(targetFolder || '').trim();
      const keys = Array.from(this._selectedCloudExplorerKeys);
      const folderPaths = keys.filter(k => k.startsWith('folder:')).map(k => k.slice(7));
      const fileIds = keys.filter(k => k.startsWith('file:')).map(k => k.slice(5));

      let movedCnt = 0;
      const updatedItems = [];

      // 1. 선택된 폴더들 이동
      let folderList = this.getCloudFoldersList();
      for (const srcPath of folderPaths) {
        if (!srcPath || cleanTarget === srcPath || cleanTarget.startsWith(srcPath + '/')) continue;
        const baseName = srcPath.split('/').pop();
        const newPath = cleanTarget ? `${cleanTarget}/${baseName}` : baseName;
        if (newPath === srcPath) continue;
        folderList = folderList.map(f => {
          if (f === srcPath) return newPath;
          if (f.startsWith(srcPath + '/')) return newPath + f.slice(srcPath.length);
          return f;
        });
        if (!folderList.includes(newPath)) folderList.push(newPath);
        if (Array.isArray(this.myLibraryCache)) {
          this.myLibraryCache.forEach(it => {
            if (!it) return;
            const curF = String(it.folder || '').trim();
            if (curF === srcPath) {
              it.folder = newPath;
              if (!updatedItems.includes(it)) updatedItems.push(it);
            } else if (curF.startsWith(srcPath + '/')) {
              it.folder = newPath + curF.slice(srcPath.length);
              if (!updatedItems.includes(it)) updatedItems.push(it);
            }
          });
        }
        movedCnt++;
      }

      // 2. 선택된 파일들 이동 (동일 폴더 내 중복 파일명 발견 시 덮어쓰기/번호붙이기/취소 확인)
      if (Array.isArray(this.myLibraryCache)) {
        const targetFiles = fileIds
          .map(id => this.myLibraryCache.find(x => x && x.id === id))
          .filter(it => it && String(it.folder || '').trim() !== cleanTarget);
        const conflictingIds = new Set(
          targetFiles
            .filter(it => Boolean(this._findDuplicateCloudItem(it.title, cleanTarget, it.id)))
            .map(it => it.id)
        );
        let batchAction = null;
        let processedConflicts = 0;

        for (const it of targetFiles) {
          const dupItem = this._findDuplicateCloudItem(it.title, cleanTarget, it.id);
          if (dupItem) {
            processedConflicts++;
            const remainingConflicts = Math.max(0, conflictingIds.size - processedConflicts);
            const nextTitle = this._getNextAvailableCloudTitle(it.title, cleanTarget, it.id);
            let chosenAction = batchAction;
            if (!chosenAction) {
              const res = await this.promptCloudDuplicateResolution(it.title, cleanTarget, nextTitle, remainingConflicts);
              chosenAction = (res && res.action) || 'cancel';
              if (res && res.applyToAll && remainingConflicts > 0) {
                batchAction = chosenAction;
              }
            }
            if (chosenAction === 'cancel') {
              continue;
            } else if (chosenAction === 'rename') {
              it.title = this._getNextAvailableCloudTitle(it.title, cleanTarget, it.id);
            } else if (chosenAction === 'overwrite') {
              await this._deleteCloudLibraryItemCompletely(dupItem);
            }
          }
          it.folder = cleanTarget;
          if (!updatedItems.includes(it)) updatedItems.push(it);
          movedCnt++;
        }
      }

      if (cleanTarget && !folderList.includes(cleanTarget)) {
        folderList.push(cleanTarget);
      }
      this._saveCloudFoldersList(folderList);
      this._saveMyLibraryCacheForCurrentUser();
      this._selectedCloudExplorerKeys.clear();
      this.syncExportCloudFolderSelect();
      this.renderMyLibraryList();

      const destLabel = cleanTarget ? `[📁 ${cleanTarget.replace(/\//g, ' › ')}]` : '[☁️ 내 클라우드]';
      if (movedCnt > 0) {
        this.showToast(`📦 선택한 ${movedCnt}개 항목을 ${destLabel}(으)로 이동했습니다.`);
      }
      for (const it of updatedItems) {
        if (it && it.id) {
          try { await this._persistCloudItemMetadataChange(it); } catch (e) { }
        }
      }
    }

    async handleCloudExplorerDeleteSelected(skipConfirm = false) {
      if (!this._selectedCloudExplorerKeys || this._selectedCloudExplorerKeys.size === 0) {
        this.showToast('🗑️ 삭제할 파일이나 폴더의 체크박스(☑)를 먼저 선택해 주세요.');
        return;
      }
      const keys = Array.from(this._selectedCloudExplorerKeys);
      const folderPaths = keys.filter(k => k.startsWith('folder:')).map(k => k.slice(7));
      const fileIds = new Set(keys.filter(k => k.startsWith('file:')).map(k => k.slice(5)));
      const totalTargetCount = folderPaths.length + fileIds.size;

      if (!skipConfirm && totalTargetCount > 0) {
        const hasLinkedPermShare = Array.isArray(this.myLibraryCache) && this.myLibraryCache.some(it => it && fileIds.has(it.id) && it.linkedShareId);
        const permWarnSuffix = hasLinkedPermShare
          ? '\n\n⚠️ 선택한 파일 중 [🔗 영구 공유 링크] 원본이 포함되어 있습니다.\n삭제 시 학생들에게 배포된 공유 링크 및 QR 코드도 즉시 함께 폭파됩니다!'
          : '';
        const confirmMsg = (folderPaths.length > 0 && fileIds.size === 0)
          ? `선택한 폴더 ${folderPaths.length}개를 삭제하시겠습니까?\n(폴더 안의 수업 파일은 삭제되지 않고 상위 폴더로 안전하게 이동됩니다.)`
          : `선택한 항목 ${totalTargetCount}개(파일 ${fileIds.size}개${folderPaths.length > 0 ? ` · 폴더 ${folderPaths.length}개` : ''})를 클라우드 보관함에서 영구 삭제하시겠습니까?${permWarnSuffix}`;
        if (!window.confirm(confirmMsg)) return;
      }

      let folderList = this.getCloudFoldersList();
      const updatedItems = [];
      const itemsToDelete = [];

      // 1. 선택된 폴더 삭제 (내부 파일은 상위 폴더로 보존)
      folderPaths.forEach(clean => {
        const isSub = clean.includes('/');
        const parentFolder = isSub ? clean.split('/').slice(0, -1).join('/') : '';
        folderList = folderList.filter(f => f !== clean && !f.startsWith(clean + '/'));
        if (Array.isArray(this.myLibraryCache)) {
          this.myLibraryCache.forEach(it => {
            if (!it || fileIds.has(it.id)) return;
            const curF = String(it.folder || '').trim();
            if (curF === clean || curF.startsWith(clean + '/')) {
              it.folder = parentFolder || '';
              if (!updatedItems.includes(it)) updatedItems.push(it);
            }
          });
        }
      });
      this._saveCloudFoldersList(folderList);

      // 2. 선택된 파일 삭제 (청크 문서 및 로컬 캐시까지 완전 삭제)
      if (Array.isArray(this.myLibraryCache) && fileIds.size > 0) {
        this.myLibraryCache = this.myLibraryCache.filter(it => {
          if (it && fileIds.has(it.id)) {
            itemsToDelete.push(it);
            return false;
          }
          return true;
        });
      }

      const totalDel = folderPaths.length + itemsToDelete.length;
      this._selectedCloudExplorerKeys.clear();
      this._saveMyLibraryCacheForCurrentUser();
      this.syncExportCloudFolderSelect();
      this.renderMyLibraryList();
      this.showToast(`🗑️ 선택한 ${totalDel}개 항목을 삭제했습니다.`);

      for (const delItem of itemsToDelete) {
        try { await this._deleteCloudLibraryItemCompletely(delItem); } catch (e) { }
      }
      for (const it of updatedItems) {
        if (it && it.id) {
          try { await this._persistCloudItemMetadataChange(it); } catch (e) { }
        }
      }
    }

    syncExportCloudFolderSelect() {
      const sel = document.getElementById('selectExportCloudFolder');
      if (!sel) return;
      const prevVal = sel.value;
      const folders = this.getCloudFoldersList();
      sel.innerHTML = `<option value="">📁 기본 보관함</option>` +
        folders.map(f => {
          const esc = f.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          return `<option value="${esc}">📁 ${esc}</option>`;
        }).join('');
      const targetVal = (prevVal && folders.includes(prevVal))
        ? prevVal
        : ((this._activeCloudFolder && folders.includes(this._activeCloudFolder)) ? this._activeCloudFolder : '');
      sel.value = targetVal;
    }

    _getMyLibraryStorageKey() {
      if (!this.cloudUser || !this.cloudUser.uid) return null;
      return `graphly_my_library_v2_${this.cloudUser.uid}`;
    }

    _loadMyLibraryCacheForCurrentUser() {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.myLibraryCache = [];
        return;
      }
      try {
        const key = this._getMyLibraryStorageKey();
        const saved = key ? localStorage.getItem(key) : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            this.myLibraryCache = parsed.filter(it => this._isOwnedByCurrentCloudUser(it));
            return;
          }
        }
      } catch (e) { }
      this.myLibraryCache = [];
    }

    _evictOldLocalCloudFullDocs(excludeDocId = null) {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('graphly_full_doc_') && (!excludeDocId || k !== 'graphly_full_doc_' + excludeDocId)) {
            keys.push(k);
          }
        }
        keys.forEach(k => {
          try { localStorage.removeItem(k); } catch (e) { }
        });
      } catch (e) { }
    }

    _saveMyLibraryCacheForCurrentUser() {
      if (!this.cloudUser || !this.cloudUser.uid) return;
      const key = this._getMyLibraryStorageKey();
      if (!key) return;
      const list = this.myLibraryCache || [];
      const lightList = list.map(it => {
        if (!it) return it;
        if (it.id && ((Array.isArray(it.playlistSlides) && it.playlistSlides.length > 0) || it.slideData) && typeof this._idbCacheSet === 'function') {
          try {
            this._idbCacheSet('graphly_full_doc_' + it.id, JSON.stringify(it)).catch(() => { });
          } catch (e) { }
        }
        return {
          ...it,
          playlistSlides: null,
          slideData: null
        };
      });
      try {
        localStorage.setItem(key, JSON.stringify(lightList));
      } catch (e) {
        this._evictOldLocalCloudFullDocs();
        try {
          localStorage.setItem(key, JSON.stringify(lightList));
        } catch (e2) { }
      }
    }

    _persistActiveCloudUserSession() {
      try {
        if (this.cloudUser && this.cloudUser.uid) {
          localStorage.setItem('graphly_active_session_user_v2', JSON.stringify(this.cloudUser));
        } else {
          localStorage.removeItem('graphly_active_session_user_v2');
        }
      } catch (e) { }
    }

    _getCanonicalUidForEmail(email, fallbackRawUid = '', authProvider = 'google') {
      const normEmail = String(email || '').trim().toLowerCase();
      const isIdAuth = (
        authProvider === 'email' ||
        authProvider === 'id' ||
        String(fallbackRawUid || '').startsWith('id_')
      );
      const prefix = isIdAuth ? 'id_' : 'acct_';
      if (normEmail && normEmail.includes('@')) {
        return prefix + normEmail.replace(/[^a-z0-9@._-]/g, '_');
      }
      const raw = String(fallbackRawUid || normEmail || 'user').trim();
      return raw.startsWith(prefix) ? raw : (prefix + raw.replace(/[^a-z0-9@._-]/g, '_'));
    }

    _registerNewDeviceSessionLock(uid) {
      if (!uid) return '';
      const nowMs = Date.now();
      const sessionId = 'sess_' + nowMs + '_' + Math.random().toString(36).slice(2, 8);
      this._lastSessionLockRegisteredAt = nowMs;
      this._lastSessionLockCheckMs = nowMs;
      this._activeRegisteredSessionId = sessionId;
      try {
        localStorage.setItem('graphly_device_session_' + uid, sessionId);
        localStorage.setItem('graphly_device_session_ts_' + uid, String(nowMs));
      } catch (e) { }
      if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol) && typeof this._firestoreRestWriteSingleDoc === 'function') {
        const writePromise = this._firestoreRestWriteSingleDoc('user_preferences', 'session_' + uid, JSON.stringify({
          uid,
          activeSessionId: sessionId,
          updatedAt: nowMs
        }), { ownerUid: uid }).catch(() => { }).finally(() => {
          if (this._pendingSessionLockWritePromise === writePromise) {
            this._pendingSessionLockWritePromise = null;
          }
        });
        this._pendingSessionLockWritePromise = writePromise;
      }
      return sessionId;
    }

    async verifyActiveDeviceSessionLock() {
      if (!this.cloudUser || !this.cloudUser.uid) return true;
      if (this._isExplicitAuthFlowInProgress) return true;
      if (this._lastSessionLockRegisteredAt && (Date.now() - this._lastSessionLockRegisteredAt < 10000)) return true;
      if (!this._canSyncCustomGraphsToFirestore() || typeof this._firestoreRestReadDoc !== 'function') return true;
      const uid = this.cloudUser.uid;
      if (this._pendingSessionLockWritePromise) {
        try { await this._pendingSessionLockWritePromise; } catch (e) { }
      }
      let localSessionId = '';
      let localSessionTs = 0;
      try {
        localSessionId = localStorage.getItem('graphly_device_session_' + uid) || '';
        localSessionTs = Number(localStorage.getItem('graphly_device_session_ts_' + uid) || 0) || 0;
      } catch (e) { }
      if (!localSessionId) {
        this._registerNewDeviceSessionLock(uid);
        return true;
      }
      try {
        const remote = await this._firestoreRestReadDoc('user_preferences', 'session_' + uid, true);
        if (!this.cloudUser || this.cloudUser.uid !== uid || this._isExplicitAuthFlowInProgress) return true;
        if (this._lastSessionLockRegisteredAt && (Date.now() - this._lastSessionLockRegisteredAt < 10000)) return true;
        let latestLocalSessionId = localSessionId;
        let latestLocalTs = localSessionTs;
        try {
          latestLocalSessionId = localStorage.getItem('graphly_device_session_' + uid) || localSessionId;
          latestLocalTs = Number(localStorage.getItem('graphly_device_session_ts_' + uid) || 0) || localSessionTs;
        } catch (e) { }
        if (remote && remote.activeSessionId && remote.activeSessionId !== latestLocalSessionId) {
          const remoteTs = Number(remote.updatedAt) || 0;
          // 서버의 세션 타임스탬프가 현재 기기 로그인 시각보다 과거이거나 같다면 이전 세션 잔상이므로 로그아웃하지 않고 현재 세션으로 서버 갱신
          if (latestLocalTs > 0 && remoteTs > 0 && remoteTs <= latestLocalTs) {
            this._firestoreRestWriteSingleDoc('user_preferences', 'session_' + uid, JSON.stringify({
              uid,
              activeSessionId: latestLocalSessionId,
              updatedAt: latestLocalTs
            }), { ownerUid: uid }).catch(() => { });
            return true;
          }
          await this.handleCloudLogout(true);
          this.showToast('🔒 다른 기기에서 로그인되어 현재 기기는 자동 로그아웃되었습니다.');
          return false;
        }
      } catch (e) { }
      return true;
    }

    _restoreActiveCloudUserSession() {
      try {
        const raw = localStorage.getItem('graphly_active_session_user_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.uid && parsed.emailVerified !== false) {
            if (parsed.email && parsed.email.includes('@')) {
              parsed.uid = this._getCanonicalUidForEmail(parsed.email, parsed.uid, parsed.authProvider || 'google');
            }
            this.cloudUser = parsed;
            this._loadMyLibraryCacheForCurrentUser();
            return;
          }
        }
      } catch (e) { }
      this.cloudUser = null;
      this.myLibraryCache = [];
    }

    switchCloudIdAuthTab(mode = 'login') {
      this._cloudIdAuthTab = (mode === 'signup') ? 'signup' : 'login';
      const tabLogin = document.getElementById('tabBtnCloudIdLogin');
      const tabSignup = document.getElementById('tabBtnCloudIdSignup');
      const extraFields = document.getElementById('cloudSignupExtraFields');
      const helperRow = document.getElementById('cloudLoginHelperRow');
      const btnSubmit = document.getElementById('btnSubmitCloudEmailLogin');
      const isSignup = (this._cloudIdAuthTab === 'signup');
      if (tabLogin) {
        tabLogin.className = isSignup ? 'settings-clean-btn' : 'settings-clean-btn active';
      }
      if (tabSignup) {
        tabSignup.className = isSignup ? 'settings-clean-btn active' : 'settings-clean-btn';
      }
      if (extraFields) {
        extraFields.style.display = isSignup ? 'flex' : 'none';
      }
      if (helperRow) {
        helperRow.style.display = isSignup ? 'none' : 'flex';
      }
      if (btnSubmit) {
        btnSubmit.textContent = isSignup ? '인증메일 발송 및 가입' : '로그인';
      }
    }

    promptCloudLoginForLibrary(toastMessage = '🔒 클라우드 보관함은 로그인 후 이용할 수 있습니다.') {
      this.showToast(toastMessage);
      if (this.isAllUIHidden && typeof this.toggleAllUIHidden === 'function') {
        this.toggleAllUIHidden(false);
      }
      const modalCloud = document.getElementById('modalCloudHub');
      if (modalCloud) modalCloud.classList.remove('show');
      const modalShare = document.getElementById('modalShare');
      if (modalShare) modalShare.classList.remove('show');
      if (typeof this.openDrawer === 'function') {
        this.openDrawer('panelSettings');
      }
      const boxEmailLogin = document.getElementById('cloudEmailLoginBox');
      if (boxEmailLogin) {
        boxEmailLogin.style.display = 'none';
      }
      const acctSec = document.getElementById('settingsAccountSection');
      if (acctSec && acctSec.scrollIntoView) {
        setTimeout(() => acctSec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      }
      this.syncCloudAuthUI();
      this.renderMyLibraryList();
    }

    getSubscriptionRemainingInfo(nowMs = Date.now()) {
      const emptyInfo = {
        tier: 'free',
        isPaid: false,
        activeExpiresAt: 0,
        remainingDays: 0,
        formattedDate: '',
        deferredProDays: 0,
        totalExpiresAt: 0,
        totalFormattedDate: ''
      };
      if (!this.cloudUser || !this.cloudUser.uid) return emptyInfo;
      const tier = this.getUserSubscriptionTier();
      if (tier !== 'pro' && tier !== 'premium') return emptyInfo;

      const uid = this.cloudUser.uid;
      const meta = (this._subStateMeta && this._subStateMeta.uid === uid)
        ? this._subStateMeta
        : this._readStoredSubStateForUid(uid);

      const DAY_MS = 24 * 60 * 60 * 1000;
      const premExp = meta ? (Number(meta.premiumExpiresAt) || 0) : 0;
      const proExp = meta ? (Number(meta.proExpiresAt) || 0) : 0;
      const totExp = meta ? (Number(meta.expiresAt) || 0) : 0;

      const activeExpiresAt = tier === 'premium'
        ? (premExp > nowMs ? premExp : (totExp > nowMs ? totExp : 0))
        : (proExp > nowMs ? proExp : (totExp > nowMs ? totExp : 0));

      const totalExpiresAt = Math.max(activeExpiresAt, proExp, totExp);
      const deferredProDays = (tier === 'premium' && activeExpiresAt > nowMs && proExp > activeExpiresAt + 60000)
        ? Math.max(1, Math.ceil((proExp - activeExpiresAt) / DAY_MS))
        : 0;

      const formatDateDot = (ts) => {
        if (!ts || !(ts > 0)) return '';
        try {
          const d = new Date(Number(ts));
          if (Number.isNaN(d.getTime())) return '';
          return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.`;
        } catch (e) {
          return '';
        }
      };

      const remainingDays = activeExpiresAt > nowMs
        ? Math.max(1, Math.ceil((activeExpiresAt - nowMs) / DAY_MS))
        : 0;

      return {
        tier,
        isPaid: true,
        activeExpiresAt,
        remainingDays,
        formattedDate: formatDateDot(activeExpiresAt),
        deferredProDays,
        totalExpiresAt,
        totalFormattedDate: formatDateDot(totalExpiresAt)
      };
    }

    refreshAccountSubscriptionStatusUI() {
      const lblStatus = document.getElementById('lblCloudUserStatus');
      const lblProAcct = document.getElementById('lblProModalAccountStatus');
      const lblProAcctBadge = document.getElementById('lblProModalAccountBadge');
      const lblSettingsAcct = document.getElementById('lblSettingsAccountStatus');

      if (!this.cloudUser) {
        if (lblStatus) {
          lblStatus.style.display = 'none';
          lblStatus.textContent = '';
        }
        if (lblProAcctBadge) {
          lblProAcctBadge.className = 'pricing-acct-badge is-guest';
          lblProAcctBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><span>로그인 필요</span>`;
        }
        if (lblProAcct) {
          lblProAcct.textContent = '결제할 계정에 먼저 로그인해 주세요.';
        }
        if (lblSettingsAcct) {
          lblSettingsAcct.classList.remove('has-sub-expiry');
          lblSettingsAcct.style.display = 'none';
          lblSettingsAcct.textContent = '';
          lblSettingsAcct.title = '';
        }
        if (typeof this.syncPromoBannerEntryButtonsUI === 'function') {
          this.syncPromoBannerEntryButtonsUI();
        }
        return;
      }

      const emailStr = this.cloudUser.email || this.cloudUser.loginId || '';
      const subInfo = this.getSubscriptionRemainingInfo();
      const tier = subInfo.tier;
      const tierTag = tier === 'premium' ? ' · 💎 Premium' : (tier === 'pro' ? ' · 👑 Pro' : '');
      const hasExpiry = subInfo.isPaid && subInfo.remainingDays > 0;

      if (lblStatus) {
        lblStatus.style.display = 'inline-flex';
        const remainSuffix = hasExpiry ? ` (${subInfo.remainingDays}일 남음)` : '';
        lblStatus.textContent = `🟢 ${this.cloudUser.displayName} (${emailStr})${tierTag}${remainSuffix}`;
      }

      if (lblProAcctBadge) {
        lblProAcctBadge.className = 'pricing-acct-badge is-verified';
        lblProAcctBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg><span>인증된 귀속 계정</span>`;
      }

      if (lblProAcct) {
        lblProAcct.innerHTML = '';
        const spanName = document.createElement('span');
        spanName.textContent = this.cloudUser.displayName || '회원';
        lblProAcct.appendChild(spanName);

        if (emailStr) {
          const spanMail = document.createElement('span');
          spanMail.className = 'acct-muted';
          spanMail.textContent = ` (${emailStr})`;
          lblProAcct.appendChild(spanMail);
        }

        if (hasExpiry) {
          const cleanTierName = tier === 'premium' ? 'Premium' : 'Pro';
          const datePart = subInfo.formattedDate ? ` · ${subInfo.formattedDate}까지` : '';
          const deferPart = subInfo.deferredProDays > 0 ? `, 이후 Pro ${subInfo.deferredProDays}일 연장` : '';
          const spanSub = document.createElement('span');
          spanSub.className = 'acct-sub-pill';
          spanSub.textContent = ` · ${cleanTierName} ${subInfo.remainingDays}일 남음${datePart}${deferPart}`;
          lblProAcct.appendChild(spanSub);
        }
      }

      if (lblSettingsAcct) {
        lblSettingsAcct.style.display = 'flex';
        lblSettingsAcct.style.color = '';
        lblSettingsAcct.style.fontSize = '';
        lblSettingsAcct.style.fontWeight = '';
        lblSettingsAcct.innerHTML = '';

        const acctText = emailStr || this.cloudUser.displayName || '';
        const planLabel = tier === 'premium' ? '💎 Premium' : (tier === 'pro' ? '👑 Pro 플랜' : '무료 플랜');
        const planClass = tier === 'premium' ? 'is-pro is-premium' : (tier === 'pro' ? 'is-pro' : 'is-free');

        const spanEmail = document.createElement('span');
        spanEmail.className = 'settings-account-id-text';
        spanEmail.textContent = acctText;
        spanEmail.title = acctText;

        const spanPlan = document.createElement('span');
        spanPlan.className = `settings-account-plan-badge ${planClass}`;
        spanPlan.textContent = planLabel;

        if (hasExpiry) {
          lblSettingsAcct.classList.add('has-sub-expiry');
          const mainRow = document.createElement('div');
          mainRow.className = 'settings-account-main-row';
          mainRow.appendChild(spanEmail);
          mainRow.appendChild(spanPlan);

          const expRow = document.createElement('div');
          expRow.className = 'settings-account-sub-expiry-row';

          const spanDays = document.createElement('span');
          spanDays.className = `settings-account-remain-days ${tier === 'premium' ? 'is-premium' : 'is-pro'}`;
          spanDays.textContent = `${subInfo.remainingDays}일 남음`;

          const spanDate = document.createElement('span');
          spanDate.className = 'settings-account-expire-date';
          const dateText = subInfo.formattedDate ? `${subInfo.formattedDate}까지` : '';
          spanDate.textContent = subInfo.deferredProDays > 0
            ? `${dateText}${dateText ? ' ' : ''}(+Pro ${subInfo.deferredProDays}일)`
            : dateText;

          expRow.appendChild(spanDays);
          if (spanDate.textContent) {
            expRow.appendChild(spanDate);
          }
          lblSettingsAcct.appendChild(mainRow);
          lblSettingsAcct.appendChild(expRow);

          const tooltipParts = [`${planLabel} · ${subInfo.remainingDays}일 남음`];
          if (subInfo.formattedDate) tooltipParts.push(`(${subInfo.formattedDate}까지)`);
          if (subInfo.deferredProDays > 0) {
            tooltipParts.push(`이후 Pro ${subInfo.deferredProDays}일 자동 연장`);
          }
          lblSettingsAcct.title = tooltipParts.join(' ');
        } else {
          lblSettingsAcct.classList.remove('has-sub-expiry');
          lblSettingsAcct.title = '';
          lblSettingsAcct.appendChild(spanEmail);
          lblSettingsAcct.appendChild(spanPlan);
        }
      }
      if (typeof this.syncPromoBannerEntryButtonsUI === 'function') {
        this.syncPromoBannerEntryButtonsUI();
      }
    }

    syncCloudAuthUI() {
      const lblBtn = document.getElementById('lblCloudAuthBtnText');
      const boxEmailLogin = document.getElementById('cloudEmailLoginBox');
      const btnEmailToggle = document.getElementById('btnCloudEmailLoginToggle');
      const verifyBanner = document.getElementById('cloudEmailVerifyBanner');
      const btnProGoLogin = document.getElementById('btnProModalGoLogin');
      const settingsLoggedOutRow = document.getElementById('settingsAccountLoggedOutActions');
      const settingsLoggedInRow = document.getElementById('settingsAccountLoggedInActions');

      this.refreshAccountSubscriptionStatusUI();

      if (this.cloudUser) {
        if (lblBtn) lblBtn.textContent = '로그아웃';
        if (boxEmailLogin) boxEmailLogin.style.display = 'none';
        if (verifyBanner) verifyBanner.style.display = 'none';
        if (btnEmailToggle) btnEmailToggle.style.display = 'none';
        if (btnProGoLogin) btnProGoLogin.style.display = 'none';
        if (settingsLoggedOutRow) settingsLoggedOutRow.style.display = 'none';
        if (settingsLoggedInRow) settingsLoggedInRow.style.display = 'flex';
      } else {
        if (lblBtn) lblBtn.textContent = '구글 로그인';
        if (btnEmailToggle) btnEmailToggle.style.display = 'inline-flex';
        if (btnProGoLogin) btnProGoLogin.style.display = 'inline-flex';
        if (settingsLoggedOutRow) settingsLoggedOutRow.style.display = 'flex';
        if (settingsLoggedInRow) settingsLoggedInRow.style.display = 'none';
      }
      if (typeof this.onCustomGraphUserChanged === 'function') {
        this.onCustomGraphUserChanged();
      }
      if (typeof this.onUserPreferencesAuthChanged === 'function') {
        this.onUserPreferencesAuthChanged();
      }
    }

    // ============================================================================
    // 👤 [로그인 계정별 개인 칠판 프로필(환경설정 · 필기바 위치 · 펜/배경 · 단축키) 클라우드 동기화 엔진]
    // - 공용 전자칠판에서 로그인하는 즉시 내 세팅으로 전환되고, 로그아웃 시 공용 기본값으로 복귀!
    // ============================================================================
    _getUserPrefsStorageKey(uid = null) {
      const targetUid = uid || ((this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest');
      return `graphly_user_prefs_v1_${targetUid}`;
    }

    _collectCurrentUserPreferences() {
      return {
        updatedAt: Date.now(),
        inkDockPosition: this.inkDockPosition || 'bottom',
        inkPenStyle: this.inkPenStyle || 'ballpen',
        savedPenColor: this.savedPenColor || '#1e293b',
        savedHighlighterColor: this.savedHighlighterColor || '#1e293b',
        inkSoftBlur: typeof this.inkSoftBlur === 'number' ? this.inkSoftBlur : 0.0,
        inkSize: typeof this.currentInkSize === 'number' ? this.currentInkSize : 4.2,
        highlighterSize: typeof this.currentHighlighterSize === 'number' ? this.currentHighlighterSize : 16,
        eraserSize: typeof this.currentEraserSize === 'number' ? this.currentEraserSize : 14,
        themeKey: this.currentThemeKey || 'white_paper',
        boardPaperType: this.boardPaperType || 'blank',
        showVirtualStylus: Boolean(this.showVirtualStylus),
        useMagneticSnap: Boolean(this.useMagneticSnap),
        showXAxis: this.showXAxis !== false,
        showYAxis: this.showYAxis !== false,
        showGuides: Boolean(this.showGuides),
        showGuidesV2: Boolean(this.showGuides),
        showGridNumbers: Boolean(this.showGridNumbers),
        showAsymptotes: Boolean(this.showAsymptotes),
        graphColorMode: this.graphColorMode || 'auto',
        fixedGraphColor: this.fixedGraphColor || '#1e293b',
        autoColorSequence: Array.isArray(this.autoColorSequence) && this.autoColorSequence.length > 0
          ? [...this.autoColorSequence]
          : ['#c74440', '#2d70b3', '#388c46', '#6042a6'],
        customShortcuts: this.customShortcuts || {},
        promoBannerConfig: this._sanitizePromoBannerConfig(this.promoBannerConfig || this._getDefaultPromoBannerConfig())
      };
    }

    _applyUserPreferences(prefs, silent = true) {
      if (!prefs || typeof prefs !== 'object') return;
      this._isApplyingUserPrefs = true;
      try {
        if (prefs.inkDockPosition && ['left', 'bottom', 'right'].includes(prefs.inkDockPosition)) {
          this.setInkDockPosition(prefs.inkDockPosition, !silent, false);
        }
        if (prefs.inkPenStyle && ['ballpen', 'flat', 'fountain', 'brush'].includes(prefs.inkPenStyle)) {
          this.setInkPenStyle(prefs.inkPenStyle, !silent);
        }
        if (prefs.savedPenColor && /^#[0-9a-fA-F]{3,8}$/.test(prefs.savedPenColor)) {
          this.savedPenColor = prefs.savedPenColor;
          try { localStorage.setItem('graphly_pen_color_v1', prefs.savedPenColor); } catch (_) { }
        }
        if (prefs.savedHighlighterColor && /^#[0-9a-fA-F]{3,8}$/.test(prefs.savedHighlighterColor)) {
          this.savedHighlighterColor = prefs.savedHighlighterColor;
          try { localStorage.setItem('graphly_highlighter_color_v1', prefs.savedHighlighterColor); } catch (_) { }
        }
        this._applyCurrentToolColorUI(this.activeInkTool === 'highlighter' ? (this.savedHighlighterColor || '#1e293b') : (this.savedPenColor || '#1e293b'));
        if (typeof prefs.inkSoftBlur === 'number' && !isNaN(prefs.inkSoftBlur)) {
          this.setInkSoftBlur(prefs.inkSoftBlur, false);
        }
        if (typeof prefs.inkSize === 'number' && !isNaN(prefs.inkSize)) {
          this.setInkSize(prefs.inkSize);
        }
        if (typeof prefs.highlighterSize === 'number' && !isNaN(prefs.highlighterSize)) {
          this.setHighlighterSize(prefs.highlighterSize);
        }
        if (typeof prefs.eraserSize === 'number' && !isNaN(prefs.eraserSize)) {
          this.setEraserSize(prefs.eraserSize);
        }
        if (prefs.themeKey && this.canvasThemes && this.canvasThemes[prefs.themeKey]) {
          this.setCanvasTheme(prefs.themeKey, !silent);
        }
        if (prefs.boardPaperType && ['blank', 'grid', 'lined', 'dot'].includes(prefs.boardPaperType)) {
          this.setBoardPaperType(prefs.boardPaperType, !silent);
        }
        if (typeof prefs.showVirtualStylus === 'boolean') {
          this.showVirtualStylus = prefs.showVirtualStylus;
          const chk = document.getElementById('chkShowVirtualStylus');
          if (chk) chk.checked = prefs.showVirtualStylus;
          this.updateInkCursor();
        }
        if (typeof prefs.useMagneticSnap === 'boolean') {
          this.useMagneticSnap = prefs.useMagneticSnap;
          const chk = document.getElementById('chkMagneticSnap');
          if (chk) chk.checked = prefs.useMagneticSnap;
        }
        this.showXAxis = (typeof prefs.showXAxis === 'boolean') ? prefs.showXAxis : true;
        this.showYAxis = (typeof prefs.showYAxis === 'boolean') ? prefs.showYAxis : true;
        if (typeof this.syncAxisVisibilityUI === 'function') {
          this.syncAxisVisibilityUI();
        }
        if (typeof prefs.showGuidesV2 === 'boolean') {
          this.showGuides = prefs.showGuidesV2;
          const chk = document.getElementById('chkGuides');
          if (chk) chk.checked = prefs.showGuidesV2;
        } else {
          this.showGuides = false;
          const chk = document.getElementById('chkGuides');
          if (chk) chk.checked = false;
        }
        if (typeof prefs.showGridNumbers === 'boolean') {
          this.showGridNumbers = prefs.showGridNumbers;
          const chk = document.getElementById('chkGridNumbers');
          if (chk) chk.checked = prefs.showGridNumbers;
        }
        if (typeof prefs.showAsymptotes === 'boolean') {
          this.showAsymptotes = prefs.showAsymptotes;
          const chk = document.getElementById('chkAsymptotes');
          if (chk) chk.checked = prefs.showAsymptotes;
        }
        if (prefs.graphColorMode === 'fixed' || prefs.graphColorMode === 'auto') {
          this.graphColorMode = prefs.graphColorMode;
          try { localStorage.setItem('graphly_graph_color_mode_v1', prefs.graphColorMode); } catch (_) { }
        }
        if (prefs.fixedGraphColor && /^#[0-9a-fA-F]{3,8}$/.test(prefs.fixedGraphColor)) {
          this.fixedGraphColor = prefs.fixedGraphColor;
          try { localStorage.setItem('graphly_fixed_graph_color_v1', prefs.fixedGraphColor); } catch (_) { }
        }
        if (Array.isArray(prefs.autoColorSequence) && prefs.autoColorSequence.length > 0) {
          const validSeq = prefs.autoColorSequence.filter(c => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c));
          if (validSeq.length > 0) {
            this.autoColorSequence = validSeq;
            this.colorPalette = [...validSeq];
            try { localStorage.setItem('graphly_auto_color_seq_v1', JSON.stringify(validSeq)); } catch (_) { }
          }
        }
        if (typeof this.syncGraphColorPaletteUI === 'function') {
          this.syncGraphColorPaletteUI();
        }
        if (prefs.customShortcuts && typeof prefs.customShortcuts === 'object') {
          this.customShortcuts = { ...prefs.customShortcuts };
          try {
            localStorage.setItem('graphly_custom_shortcuts_v1', JSON.stringify(this.customShortcuts));
          } catch (_) { }
          if (typeof this.syncShortcutTooltipsAndGuideUI === 'function') {
            this.syncShortcutTooltipsAndGuideUI();
          }
        }
        if (prefs.promoBannerConfig && typeof prefs.promoBannerConfig === 'object') {
          this._savePromoBannerConfigForCurrentUser(prefs.promoBannerConfig, false);
        }
        this.requestRender();
      } finally {
        this._isApplyingUserPrefs = false;
      }
    }

    scheduleSaveUserPreferences() {
      if (this._isApplyingUserPrefs) return;
      const prefs = this._collectCurrentUserPreferences();
      try {
        localStorage.setItem(this._getUserPrefsStorageKey(), JSON.stringify(prefs));
      } catch (_) { }

      if (this._saveUserPrefsTimer) {
        clearTimeout(this._saveUserPrefsTimer);
      }
      this._saveUserPrefsTimer = setTimeout(() => {
        if (this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestWriteSingleDoc === 'function') {
          const docId = `pref_user_${this.cloudUser.uid}`;
          this._firestoreRestWriteSingleDoc('user_preferences', docId, JSON.stringify(this._collectCurrentUserPreferences())).catch(() => { });
        }
      }, 450);
    }

    async onUserPreferencesAuthChanged() {
      const curUid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest';
      const prevUid = this._lastSyncedPrefsUid || null;
      if (prevUid === curUid) return;
      this._lastSyncedPrefsUid = curUid;

      if (curUid === 'guest') {
        // 로그인 상태에서 로그아웃한 경우: 공용 칠판 보호를 위해 표준 기본값으로 깔끔하게 초기화!
        if (prevUid && prevUid !== 'guest') {
          const defaultPrefs = {
            inkDockPosition: 'bottom',
            inkPenStyle: 'ballpen',
            inkSoftBlur: 0.0,
            inkSize: 4.2,
            highlighterSize: 16,
            eraserSize: 14,
            themeKey: 'white_paper',
            boardPaperType: 'blank',
            showVirtualStylus: true,
            useMagneticSnap: true,
            showXAxis: true,
            showYAxis: true,
            showGuides: false,
            showGuidesV2: false,
            showGridNumbers: false,
            showAsymptotes: false,
            graphColorMode: 'auto',
            fixedGraphColor: '#1e293b',
            autoColorSequence: ['#c74440', '#2d70b3', '#388c46', '#6042a6'],
            customShortcuts: {},
            promoBannerConfig: this._getDefaultPromoBannerConfig()
          };
          this._applyUserPreferences(defaultPrefs, true);
          try {
            localStorage.setItem(this._getUserPrefsStorageKey('guest'), JSON.stringify(defaultPrefs));
          } catch (_) { }
        } else {
          this._loadPromoBannerConfigForCurrentUser();
        }
        return;
      }

      this._loadPromoBannerConfigForCurrentUser();

      // 1. 로컬에 캐시된 해당 계정 프로필이 있으면 0.00초 만에 즉시 먼저 적용
      let localPrefs = null;
      try {
        const raw = localStorage.getItem(this._getUserPrefsStorageKey(curUid));
        if (raw) {
          localPrefs = JSON.parse(raw);
          if (localPrefs && typeof localPrefs === 'object') {
            this._applyUserPreferences(localPrefs, true);
          }
        }
      } catch (_) { }

      // 2. 클라우드(Firestore)에 저장된 계정 프로필 조회 및 동기화
      if (this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestReadDoc === 'function') {
        try {
          const docId = `pref_user_${curUid}`;
          const remotePrefs = await this._firestoreRestReadDoc('user_preferences', docId, true);
          if (remotePrefs && typeof remotePrefs === 'object' && (remotePrefs.inkDockPosition || remotePrefs.themeKey)) {
            this._applyUserPreferences(remotePrefs, true);
            try {
              localStorage.setItem(this._getUserPrefsStorageKey(curUid), JSON.stringify(remotePrefs));
            } catch (_) { }
          } else if (!localPrefs) {
            // 첫 로그인 계정이면 현재 세팅을 클라우드 초기 프로필로 등록
            this.scheduleSaveUserPreferences();
          }
        } catch (_) { }
      }
    }

    // ============================================================================
    // 👑 [3단계 요금제(Free · Pro · Premium) 정책 · 가격 · 쿼터 컨트롤 타워]
    // - 추후 가격이나 무료/Pro/Premium 용량·개수·녹화시간·링크기한을 조정할 때
    //   아래 SUBSCRIPTION_QUOTA_CONFIG 객체의 숫자만 바꾸면 전체 UI와 한도 가드가 자동 반영됩니다!
    // ============================================================================
    getSubscriptionQuotaConfig() {
      if (!this.SUBSCRIPTION_QUOTA_CONFIG) {
        const MB = 1024 * 1024;
        const GB = 1024 * 1024 * 1024;
        this.SUBSCRIPTION_QUOTA_CONFIG = {
          enforceCustomGraphLimit: true,
          maxLessonSlides: 50,
          freeMaxSlides: 50,
          proMaxSlides: 50,
          premiumMaxSlides: 50,
          maxSingleSharePayloadBytes: 80 * MB, // 단일 수업 노트/공유 패키지 최대 용량 가드 (80 MB)
          shareBurstLimitPerMin: 15,           // 매크로 폭주 방지 분당 신규 공유 링크 상한

          // [1] Free (무료 회원 · 비로그인 공통 기준 / 클라우드·프리셋은 로그인 전용)
          freeMaxCloudBytes: 100 * MB,         // 클라우드 보관함 용량 100 MB (로그인 시)
          freeMaxCustomGraphs: 3,              // ⭐ 내 그래프 프리셋 최대 3개 (로그인 시)
          freeMaxRecordMs: 5 * 60 * 1000,      // 1회 수업 녹화 최대 5분 (300,000ms)
          freeShareDailyLimit: 5,              // 공유 링크 1일 5개 제한
          freeShareExpiryDays: 3,              // 공유 링크 3일 후 만료
          freeShareDailyViewLimit: 30,         // 공유 링크당 일일 최대 열람 인원(기기) 30명

          // [2] Pro (프로)
          proMaxCloudBytes: 5 * GB,            // 클라우드 보관함 용량 5 GB
          proMaxCustomGraphs: 30,              // ⭐ 내 그래프 프리셋 최대 30개
          proMaxRecordMs: 60 * 60 * 1000,      // 1회 수업 녹화 최대 60분 (3,600,000ms)
          proShareExpiryDays: 7,               // 공유 링크 무제한 · 7일 후 만료
          proShareDailyViewLimit: 100,         // 공유 링크당 일일 최대 열람 인원(기기) 100명
          proMonthlyPrice: 4900,               // 월간(30일) 할인가 (VAT 포함)
          proMonthlyRegularPrice: 9900,        // 월간(30일) 정가 표시용
          proYearlyPrice: 49000,               // 연간(365일) 할인가 (VAT 포함)
          proYearlyRegularPrice: 99000,        // 연간(365일) 정가 표시용

          // [3] Premium (프리미엄)
          premiumMaxCloudBytes: 20 * GB,       // 클라우드 보관함 용량 20 GB
          premiumMaxCustomGraphs: 100,         // ⭐ 내 그래프 프리셋 최대 100개
          premiumMaxRecordMs: 60 * 60 * 1000,  // 1회 수업 녹화 최대 60분 (3,600,000ms)
          premiumSharePermanent: true,         // 공유 링크 무제한 · 영구 유지
          premiumShareDailyViewLimit: 300,     // 공유 링크당 일일 최대 열람 인원(기기) 300명
          premiumShareFolderName: '🔗 공유 링크', // 링크 원본 자동 귀속 전용 폴더
          premiumShareGraceDays: 7,            // 만료 시 7일 유예 후 공유 링크 일시잠금 (문서 삭제 금지 · 재구독 시 즉시 복구)
          premiumPromoBannerEnabled: true,     // 뷰어 상단 홍보배너 제공
          premiumMonthlyPrice: 9900,           // 월간(30일) 할인가 (VAT 포함)
          premiumMonthlyRegularPrice: 19900,   // 월간(30일) 정가 표시용
          premiumYearlyPrice: 99000,           // 연간(365일) 할인가 (VAT 포함)
          premiumYearlyRegularPrice: 199000    // 연간(365일) 정가 표시용
        };
      }
      return this.SUBSCRIPTION_QUOTA_CONFIG;
    }

    formatBytesHuman(bytes) {
      const b = Math.max(0, Number(bytes) || 0);
      if (b === 0) return '0 KB';
      const KB = 1024;
      const MB = 1024 * 1024;
      const GB = 1024 * 1024 * 1024;
      if (b >= GB) {
        const val = b / GB;
        return `${val >= 10 ? Math.round(val) : Math.round(val * 10) / 10} GB`;
      }
      if (b >= MB) {
        const val = b / MB;
        return `${val >= 10 ? Math.round(val) : Math.round(val * 10) / 10} MB`;
      }
      return `${Math.max(1, Math.round(b / KB))} KB`;
    }

    getMaxLessonSlidesLimit() {
      const cfg = this.getSubscriptionQuotaConfig();
      return (cfg && Number(cfg.maxLessonSlides) > 0) ? Number(cfg.maxLessonSlides) : 50;
    }

    canAddMoreSlidesWithQuota(addCount = 1) {
      const maxSlides = this.getMaxLessonSlidesLimit();
      const currentCount = (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0)
        ? this.lessonPlaylistSlides.length
        : 1;
      const needed = Math.max(1, Number(addCount) || 1);
      if (currentCount + needed > maxSlides) {
        const msg = `쾌적한 판서 반응속도와 아이패드·클라우드 안정성을 위해 한 수업 노트는 최대 ${maxSlides}장까지 담을 수 있습니다. (현재 ${currentCount}장) 다음 단원이나 문항은 새 노트로 나누어 진행해 주세요!`;
        this.showToast(`⚠️ 한 수업 노트는 최대 ${maxSlides}장까지 추가할 수 있습니다.`);
        if (typeof this.showTossPaymentResultModal === 'function') {
          this.showTossPaymentResultModal({
            status: 'warning',
            title: `수업 노트 최대 슬라이드 한도 (${maxSlides}장)`,
            message: msg
          });
        }
        return false;
      }
      return true;
    }

    _getProStorageKeyForUid(uid) {
      if (!uid) return 'graphly_pro_active_v1';
      return `graphly_pro_active_v2_${uid}`;
    }

    _getSubStateStorageKeyForUid(uid) {
      if (!uid) return 'graphly_sub_state_v3_guest';
      return `graphly_sub_state_v3_${uid}`;
    }

    _readStoredSubStateForUid(uid) {
      if (!uid) return null;
      try {
        const rawV3 = localStorage.getItem(this._getSubStateStorageKeyForUid(uid));
        if (rawV3) {
          const parsed = JSON.parse(rawV3);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) { }
      return null;
    }

    _writeStoredSubStateForUid(uid, subMeta) {
      if (!uid) return;
      try {
        const v3Key = this._getSubStateStorageKeyForUid(uid);
        const legacyKey = this._getProStorageKeyForUid(uid);
        if (subMeta && (subMeta.isPro || subMeta.tier === 'pro' || subMeta.tier === 'premium')) {
          const normalized = { ...subMeta, uid };
          localStorage.setItem(v3Key, JSON.stringify(normalized));
          localStorage.setItem(legacyKey, 'true');
          if (this.cloudUser && this.cloudUser.uid === uid) {
            this._subStateMeta = normalized;
          }
        } else {
          localStorage.removeItem(v3Key);
          localStorage.removeItem(legacyKey);
          if (this.cloudUser && this.cloudUser.uid === uid) {
            this._subStateMeta = { uid, tier: 'free', isPro: false, isPremium: false, expiresAt: 0, proExpiresAt: 0, premiumExpiresAt: 0 };
          }
        }
        localStorage.removeItem('graphly_pro_active_v1');
      } catch (e) { }
    }

    getUserSubscriptionTier() {
      if (!this.cloudUser || !this.cloudUser.uid) return 'free';
      const uid = this.cloudUser.uid;
      let meta = (this._subStateMeta && this._subStateMeta.uid === uid)
        ? this._subStateMeta
        : this._readStoredSubStateForUid(uid);
      if (meta && (!this._subStateMeta || this._subStateMeta.uid !== uid)) {
        this._subStateMeta = { ...meta, uid };
      }
      const nowMs = Date.now();
      if (meta) {
        const premExp = Number(meta.premiumExpiresAt) || 0;
        const proExp = Number(meta.proExpiresAt) || 0;
        const totalExp = Number(meta.expiresAt) || 0;
        if (premExp > nowMs) return 'premium';
        if (proExp > nowMs) return 'pro';
        if (totalExp > nowMs) {
          return meta.tier === 'premium' ? 'premium' : 'pro';
        }
        if (premExp > 0 || proExp > 0 || totalExp > 0) {
          return 'free';
        }
      }
      if (this.cloudUser.tier === 'premium') return 'premium';
      if (this.cloudUser.tier === 'pro' || this.cloudUser.isPro === true || this.isProUser === true) return 'pro';
      return 'free';
    }

    isPremiumSubscriber() {
      return this.getUserSubscriptionTier() === 'premium';
    }

    isProSubscriber() {
      const tier = this.getUserSubscriptionTier();
      return tier === 'pro' || tier === 'premium';
    }

    getCurrentTierQuota() {
      const cfg = this.getSubscriptionQuotaConfig();
      const tier = this.getUserSubscriptionTier();
      if (tier === 'premium') {
        const maxBytes = Number(cfg.premiumMaxCloudBytes) || (20 * 1024 * 1024 * 1024);
        const isPerm = Boolean(cfg.premiumSharePermanent);
        return {
          tier: 'premium',
          label: '💎 Premium',
          tierLabel: '💎 Premium',
          maxCloudBytes: maxBytes,
          maxCloudLabel: this.formatBytesHuman(maxBytes),
          maxCustomGraphs: Number(cfg.premiumMaxCustomGraphs) || 100,
          maxRecordMs: Number(cfg.premiumMaxRecordMs) || (60 * 60 * 1000),
          sharePermanent: isPerm,
          isPermanentShare: isPerm,
          shareDailyLimit: 0,
          shareDailyViewLimit: Number(cfg.premiumShareDailyViewLimit) || 300,
          shareExpiryDays: 0,
          shareFolderName: cfg.premiumShareFolderName || '🔗 공유 링크',
          shareGraceDays: Number(cfg.premiumShareGraceDays) || 7
        };
      }
      if (tier === 'pro') {
        const maxBytes = Number(cfg.proMaxCloudBytes) || (5 * 1024 * 1024 * 1024);
        return {
          tier: 'pro',
          label: '👑 Pro',
          tierLabel: '👑 Pro',
          maxCloudBytes: maxBytes,
          maxCloudLabel: this.formatBytesHuman(maxBytes),
          maxCustomGraphs: Number(cfg.proMaxCustomGraphs) || 30,
          maxRecordMs: Number(cfg.proMaxRecordMs) || (60 * 60 * 1000),
          sharePermanent: false,
          isPermanentShare: false,
          shareDailyLimit: 0,
          shareDailyViewLimit: Number(cfg.proShareDailyViewLimit) || 100,
          shareExpiryDays: Number(cfg.proShareExpiryDays) || 7,
          shareFolderName: '',
          shareGraceDays: 0
        };
      }
      const maxBytes = Number(cfg.freeMaxCloudBytes) || (100 * 1024 * 1024);
      const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
      return {
        tier: 'free',
        isGuest: !isLoggedIn,
        label: isLoggedIn ? '무료' : '비로그인',
        tierLabel: isLoggedIn ? '무료' : '비로그인',
        maxCloudBytes: maxBytes,
        maxCloudLabel: this.formatBytesHuman(maxBytes),
        maxCustomGraphs: isLoggedIn ? (Number(cfg.freeMaxCustomGraphs) || 3) : 0,
        maxRecordMs: Number(cfg.freeMaxRecordMs) || (5 * 60 * 1000),
        sharePermanent: false,
        isPermanentShare: false,
        shareDailyLimit: Number(cfg.freeShareDailyLimit) || 5,
        shareDailyViewLimit: Number(cfg.freeShareDailyViewLimit) || 30,
        shareExpiryDays: Number(cfg.freeShareExpiryDays) || 3,
        shareFolderName: '',
        shareGraceDays: 0
      };
    }

    _extractSubMetaFromDoc(uid, docObj) {
      if (!docObj || typeof docObj !== 'object') {
        return { uid, tier: 'free', isPro: false, isPremium: false, expiresAt: 0, proExpiresAt: 0, premiumExpiresAt: 0 };
      }
      const nowMs = Date.now();
      const expiresAt = Number(docObj.expiresAt) || 0;
      const premiumExpiresAt = Number(docObj.premiumExpiresAt) || ((docObj.tier === 'premium' && expiresAt > 0) ? expiresAt : 0);
      const proExpiresAt = Number(docObj.proExpiresAt) || (expiresAt > 0 ? expiresAt : 0);
      let tier = 'free';
      if (docObj.isPro === true) {
        if (premiumExpiresAt > nowMs) {
          tier = 'premium';
        } else if (proExpiresAt > nowMs || (!expiresAt && !proExpiresAt)) {
          tier = docObj.tier === 'premium' && !premiumExpiresAt && !expiresAt ? 'premium' : 'pro';
        }
      }
      return {
        uid,
        tier,
        isPro: tier === 'pro' || tier === 'premium',
        isPremium: tier === 'premium',
        expiresAt,
        proExpiresAt,
        premiumExpiresAt,
        updatedAt: nowMs
      };
    }

    async syncUserProSubscriptionFromCloud() {
      if (this._isConfirmingTossPayment) return this.isProSubscriber();
      if (!this.cloudUser || !this.cloudUser.uid) {
        this._subStateMeta = null;
        this.isProUser = false;
        return false;
      }
      const targetUid = this.cloudUser.uid;
      const storedV3 = this._readStoredSubStateForUid(targetUid);
      if (storedV3) {
        this._subStateMeta = this._extractSubMetaFromDoc(targetUid, storedV3);
      } else {
        let legacyLocalPro = false;
        try {
          legacyLocalPro = (localStorage.getItem(this._getProStorageKeyForUid(targetUid)) === 'true');
        } catch (e) { }
        this._subStateMeta = legacyLocalPro
          ? { uid: targetUid, tier: 'pro', isPro: true, isPremium: false, expiresAt: 0, proExpiresAt: 0, premiumExpiresAt: 0 }
          : { uid: targetUid, tier: 'free', isPro: false, isPremium: false, expiresAt: 0, proExpiresAt: 0, premiumExpiresAt: 0 };
      }
      const initialTier = this.getUserSubscriptionTier();
      this.cloudUser.tier = initialTier;
      this.cloudUser.isPro = (initialTier !== 'free');
      this.isProUser = this.cloudUser.isPro;
      if (!this.isProUser && storedV3) {
        this._writeStoredSubStateForUid(targetUid, null);
      }

      if (this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestReadDoc === 'function') {
        try {
          const idToken = await this._getFirebaseIdTokenForRest(true);
          if (!idToken) {
            return this.isProSubscriber();
          }
          const subDocId = `sub_${targetUid}`;
          let matchedSubUid = targetUid;
          let remoteSub = await this._firestoreRestReadDoc('user_subscriptions', subDocId, true);
          let resolvedMeta = this._extractSubMetaFromDoc(targetUid, remoteSub);

          // 동일 본인인증 이메일의 교차 로그인(Google acct_... ↔ 아이디 id_...) 구독 문서도 함께 조회하여 상위 등급/유효 구독 승계
          if (this.cloudUser.email && this.cloudUser.email.includes('@')) {
            const altProvider = this.cloudUser.authProvider === 'google' ? 'email' : 'google';
            const siblingUid = this._getCanonicalUidForEmail(this.cloudUser.email, '', altProvider);
            if (siblingUid && siblingUid !== targetUid) {
              const siblingSub = await this._firestoreRestReadDoc('user_subscriptions', `sub_${siblingUid}`, true);
              const siblingMeta = this._extractSubMetaFromDoc(targetUid, siblingSub);
              const rank = (t) => (t === 'premium' ? 2 : (t === 'pro' ? 1 : 0));
              if (rank(siblingMeta.tier) > rank(resolvedMeta.tier) || (rank(siblingMeta.tier) === rank(resolvedMeta.tier) && siblingMeta.expiresAt > resolvedMeta.expiresAt)) {
                remoteSub = siblingSub;
                matchedSubUid = siblingUid;
                resolvedMeta = siblingMeta;
              }
            }
          }

          const applySubMeta = (metaObj) => {
            if (!this.cloudUser || this.cloudUser.uid !== targetUid) return;
            this._subStateMeta = metaObj;
            const nextTier = this.getUserSubscriptionTier();
            this.cloudUser.tier = nextTier;
            this.cloudUser.isPro = (nextTier !== 'free');
            this.cloudUser.isPremium = (nextTier === 'premium');
            this.isProUser = this.cloudUser.isPro;
            this._writeStoredSubStateForUid(targetUid, nextTier !== 'free' ? metaObj : null);
            this._persistActiveCloudUserSession();
            this.syncCloudAuthUI();
            this.syncProPricingModalUI();
            this.renderMyLibraryList();
            this.renderFuncList();
            if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
          };

          applySubMeta(resolvedMeta);

          // 🔄 토스페이먼츠 상점관리자에서 직접 결제를 취소했는지 백그라운드 실시간 교차 검증 및 즉시 등급 재계산
          if (resolvedMeta.isPro && remoteSub && (remoteSub.paymentKey || remoteSub.orderId || remoteSub.hasPaymentRecord || Array.isArray(remoteSub.activeOrders)) && !this._isVerifyingTossSubStatus) {
            this._isVerifyingTossSubStatus = true;
            const verifyEndpoint = this.TOSS_VERIFY_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/verifyTossSubscriptionStatus';
            fetch(verifyEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + idToken
              },
              body: JSON.stringify({
                uid: matchedSubUid
              })
            })
              .then((r) => r.json().catch(() => null))
              .then((verifyData) => {
                if (!verifyData || !verifyData.ok) return;
                if (verifyData.revoked === true || verifyData.isPro === false) {
                  applySubMeta({ uid: targetUid, tier: 'free', isPro: false, isPremium: false, expiresAt: 0, proExpiresAt: 0, premiumExpiresAt: 0 });
                  if (typeof this.showTossPaymentResultModal === 'function') {
                    this.showTossPaymentResultModal({
                      status: 'error',
                      title: '결제 취소 확인 (이용권 회수)',
                      message: '토스페이먼츠 결제 취소 내역이 확인되어 무료 플랜으로 전환되었습니다.'
                    });
                  }
                } else if (verifyData.tier) {
                  const nextMeta = this._extractSubMetaFromDoc(targetUid, verifyData);
                  const expChanged = Math.abs((Number(nextMeta.expiresAt) || 0) - (Number(resolvedMeta.expiresAt) || 0)) > 60000
                    || Math.abs((Number(nextMeta.proExpiresAt) || 0) - (Number(resolvedMeta.proExpiresAt) || 0)) > 60000
                    || Math.abs((Number(nextMeta.premiumExpiresAt) || 0) - (Number(resolvedMeta.premiumExpiresAt) || 0)) > 60000;
                  if (nextMeta.tier !== resolvedMeta.tier || expChanged) {
                    applySubMeta(nextMeta);
                  }
                }
              })
              .catch(() => { })
              .finally(() => {
                this._isVerifyingTossSubStatus = false;
              });
          }
        } catch (e) { }
      }
      return this.isProSubscriber();
    }

    _normalizeAndCapCustomGraphPresets(list) {
      if (!Array.isArray(list) || list.length === 0) return [];
      const cfg = this.getSubscriptionQuotaConfig();
      const hardCap = Math.max(
        Number(cfg.premiumMaxCustomGraphs) || 100,
        Number(cfg.proMaxCustomGraphs) || 30,
        Number(cfg.freeMaxCustomGraphs) || 3
      );

      const byId = new Map();
      const seenSig = new Set();
      const sorted = list
        .filter(it => it && it.id && it.snapshot)
        .slice()
        .sort((a, b) => ((a && a.createdAt) || 0) - ((b && b.createdAt) || 0));

      sorted.forEach(item => {
        if (byId.has(item.id)) return;
        const sig = `${item.name || ''}|${item.badge || ''}|${item.svgThumb || ''}`;
        if (seenSig.has(sig)) return;
        seenSig.add(sig);
        byId.set(item.id, item);
      });

      const uniqueList = Array.from(byId.values());
      if (cfg.enforceCustomGraphLimit && uniqueList.length > hardCap) {
        return uniqueList.slice(0, hardCap);
      }
      return uniqueList;
    }

    getCustomGraphQuotaStatus() {
      const cfg = this.getSubscriptionQuotaConfig();
      const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
      const freeLimit = Number(cfg.freeMaxCustomGraphs) || 3;
      const proLimit = Number(cfg.proMaxCustomGraphs) || 30;
      const premiumLimit = Number(cfg.premiumMaxCustomGraphs) || 100;
      if (!isLoggedIn) {
        return {
          tier: 'guest',
          isGuest: true,
          isPro: false,
          currentCount: 0,
          maxLimit: 0,
          premiumLimit,
          proLimit,
          freeLimit,
          isReached: true,
          badgeText: '🔒 로그인 필요'
        };
      }
      const tier = this.getUserSubscriptionTier();
      const isPro = (tier === 'pro' || tier === 'premium');
      const maxLimit = tier === 'premium' ? premiumLimit : (tier === 'pro' ? proLimit : freeLimit);
      const hardCap = Math.max(premiumLimit, proLimit, freeLimit);
      if (Array.isArray(this.customGraphPresets) && cfg.enforceCustomGraphLimit && this.customGraphPresets.length > hardCap) {
        this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(this.customGraphPresets);
        try {
          localStorage.setItem(this._getCustomGraphsStorageKey(), JSON.stringify(this.customGraphPresets));
        } catch (e) { }
      }
      const totalCount = Array.isArray(this.customGraphPresets) ? this.customGraphPresets.length : 0;
      const isReached = Boolean(cfg.enforceCustomGraphLimit && totalCount >= maxLimit);
      let badgeText = '';
      if (tier === 'premium') {
        badgeText = `💎 Premium ${totalCount} / ${maxLimit}`;
      } else if (tier === 'pro') {
        badgeText = totalCount > maxLimit
          ? `👑 Pro ${maxLimit} / ${maxLimit} (보관 ${totalCount})`
          : `👑 Pro ${totalCount} / ${maxLimit}`;
      } else if (totalCount > maxLimit) {
        badgeText = `무료 ${maxLimit} / ${maxLimit} (보관 ${totalCount})`;
      } else {
        badgeText = `무료 ${totalCount} / ${maxLimit}`;
      }
      return {
        tier,
        isGuest: false,
        isPro,
        currentCount: totalCount,
        maxLimit,
        premiumLimit,
        proLimit,
        freeLimit,
        isReached,
        badgeText
      };
    }

    // ============================================================================
    // ⭐ [개인별 '자주 쓰는 내 그래프' 보관함 (My Custom Graph Presets) 엔진]
    // ============================================================================
    showTossPaymentResultModal({ status = 'success', title = '', message = '', planName = '', amount = 0, expiresAt = 0, tier = '' } = {}) {
      if (typeof document === 'undefined' || !document.body) return;
      let backdrop = document.getElementById('modalTossPaymentResult');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'modalTossPaymentResult';
        backdrop.className = 'smart-modal-backdrop';
        backdrop.style.zIndex = '100020';
        document.body.appendChild(backdrop);
      }
      const isLoading = status === 'loading';
      const isSuccess = status === 'success';
      const isPremium = tier === 'premium' || /premium|프리미엄/i.test(String(planName || title || ''));
      const accentColor = isPremium ? '#7c3aed' : '#2563eb';
      const icon = isLoading ? '⏳' : (isSuccess ? (isPremium ? '💎' : '🎉') : '⚠️');
      const resolvedTitle = title || (isLoading ? '결제 승인 확인 중...' : (isSuccess ? `Graphly ${isPremium ? 'Premium' : 'Pro'} 결제가 완료되었습니다!` : '결제 안내'));
      const numAmt = Number(amount) || 0;
      const formattedAmt = numAmt > 0 ? `${numAmt.toLocaleString('ko-KR')}원 (VAT 포함)` : '';
      let formattedExp = '';
      if (expiresAt && Number(expiresAt) > 0) {
        try {
          const d = new Date(Number(expiresAt));
          if (!Number.isNaN(d.getTime())) {
            formattedExp = `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}.까지`;
          }
        } catch (e) { }
      }
      const escapeText = (str) => String(str || '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
      const benefitHighlightText = isPremium
        ? '💎 클라우드 20GB · 내 그래프 100개 · 60분 녹화 · 영구 링크 · 홍보배너 활성화'
        : '👑 클라우드 5GB · 내 그래프 30개 · 60분 녹화 · 무제한 공유(7일) 활성화';

      backdrop.innerHTML = `
      <div class="smart-modal-card" style="max-width: 450px; width: 92%; text-align: center; padding: 26px 22px 20px;">
        <div style="font-size: 42px; line-height: 1; margin-bottom: 12px;">${icon}</div>
        <div style="font-size: 18.5px; font-weight: 800; color: ${isSuccess ? accentColor : 'inherit'}; margin-bottom: 8px;">
          ${escapeText(resolvedTitle)}
        </div>
        <div style="font-size: 13.5px; opacity: 0.85; line-height: 1.55; margin-bottom: 16px;">
          ${escapeText(message || (isSuccess ? `결제가 최종 승인되어 모든 ${isPremium ? 'Premium' : 'Pro'} 기능이 즉시 활성화되었습니다.` : ''))}
        </div>
        ${isSuccess ? `
          <div style="background: rgba(37,99,235,0.07); border: 1px solid rgba(37,99,235,0.22); border-radius: 12px; padding: 14px; text-align: left; font-size: 13px; display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px;">
            ${planName ? `<div style="display:flex; justify-content:space-between; gap:8px;"><span style="opacity:0.75; font-weight:600;">이용권</span><strong style="font-weight:800;">${escapeText(planName)}</strong></div>` : ''}
            ${formattedAmt ? `<div style="display:flex; justify-content:space-between; gap:8px;"><span style="opacity:0.75; font-weight:600;">결제 금액</span><strong style="color:${accentColor}; font-weight:800;">${escapeText(formattedAmt)}</strong></div>` : ''}
            ${formattedExp ? `<div style="display:flex; justify-content:space-between; gap:8px;"><span style="opacity:0.75; font-weight:600;">이용 기간</span><strong style="font-weight:800;">${escapeText(formattedExp)}</strong></div>` : ''}
            <div style="border-top: 1px dashed rgba(148,163,184,0.35); margin-top: 4px; padding-top: 8px; font-size: 11.8px; color: ${accentColor}; font-weight: 700; text-align: center;">
              ${benefitHighlightText}
            </div>
          </div>
        ` : ''}
        ${!isLoading ? `
          <button type="button" id="btnConfirmTossPaymentResultModal" class="btn-primary"
            style="width: 100%; padding: 12.5px; border-radius: 10px; font-size: 14.5px; font-weight: 800; background: ${isSuccess ? (isPremium ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'linear-gradient(135deg,#2563eb,#4f46e5)') : '#334155'}; color: #fff; border: none; cursor: pointer;">
            ${isSuccess ? `${isPremium ? '💎' : '👑'} 확인 (바로 시작하기)` : '확인'}
          </button>
        ` : ''}
      </div>
    `;
      backdrop.classList.add('show');
      const btnClose = backdrop.querySelector('#btnConfirmTossPaymentResultModal');
      if (btnClose) {
        btnClose.onclick = () => {
          backdrop.classList.remove('show');
        };
      }
    }

    async _saveWorkspaceBeforeTossRedirect() {
      if (typeof this._idbCacheSet !== 'function') return;
      try {
        let slides = [];
        let curIdx = 0;
        if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
          this.saveCurrentSlideIntoPlaylist();
          slides = JSON.parse(JSON.stringify(this.lessonPlaylistSlides));
          curIdx = Math.max(0, Math.min(slides.length - 1, Number(this.lessonPlaylistIndex) || 0));
        } else {
          slides = [this.serializeFullSlideState('작업 복원')];
          curIdx = 0;
        }
        const backupObj = {
          savedAt: Date.now(),
          isLessonPlaylistActive: Boolean(this.isLessonPlaylistActive),
          lessonPlaylistIndex: curIdx,
          slides
        };
        const packed = await this._compressJsonStringGzipBase64(JSON.stringify(backupObj));
        await this._idbCacheSet('graphly_pre_payment_workspace_v1', packed, Date.now() + (2 * 60 * 60 * 1000));
      } catch (e) { }
    }

    async _restoreWorkspaceAfterTossRedirect() {
      if (typeof this._idbCacheGet !== 'function') return false;
      try {
        const raw = await this._idbCacheGet('graphly_pre_payment_workspace_v1');
        if (!raw) return false;
        if (typeof this._idbCacheDelete === 'function') {
          await this._idbCacheDelete('graphly_pre_payment_workspace_v1').catch(() => { });
        }
        const uncomp = typeof raw === 'string' ? await this._decompressJsonStringGzipBase64(raw) : JSON.stringify(raw);
        const parsed = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
        if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) return false;
        if (parsed.savedAt && (Date.now() - Number(parsed.savedAt) > 2 * 60 * 60 * 1000)) return false;

        if (parsed.slides.length > 1 || parsed.isLessonPlaylistActive) {
          const targetIdx = Math.max(0, Math.min(parsed.slides.length - 1, Number(parsed.lessonPlaylistIndex) || 0));
          this.startLessonPlaylist(parsed.slides, targetIdx);
        } else {
          this.deserializeFullSlideState(parsed.slides[0]);
          this.syncLessonPlaylistNavBarUI();
        }
        if (typeof this.requestRender === 'function') {
          this.requestRender();
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    _inferPlanCodeFromOrder(orderId, amount, explicitPlanCode = '') {
      const cleanCode = String(explicitPlanCode || '').trim().toUpperCase();
      if (cleanCode === 'PRO_1M' || cleanCode === 'PRO_1Y' || cleanCode === 'PREMIUM_1M' || cleanCode === 'PREMIUM_1Y') {
        return cleanCode;
      }
      const oid = String(orderId || '').toUpperCase();
      if (oid.startsWith('GRAPHLY_PREMIUM_1Y_')) return 'PREMIUM_1Y';
      if (oid.startsWith('GRAPHLY_PREMIUM_1M_')) return 'PREMIUM_1M';
      if (oid.startsWith('GRAPHLY_PRO_1Y_')) return 'PRO_1Y';
      if (oid.startsWith('GRAPHLY_PRO_1M_')) return 'PRO_1M';
      const cfg = this.getSubscriptionQuotaConfig();
      const numAmt = Number(amount) || 0;
      if (numAmt === Number(cfg.premiumYearlyPrice) || numAmt === 149000) return 'PREMIUM_1Y';
      if (numAmt === Number(cfg.premiumMonthlyPrice) || numAmt === 14900) return 'PREMIUM_1M';
      if (numAmt === Number(cfg.proYearlyPrice) || numAmt === 39000) return 'PRO_1Y';
      return 'PRO_1M';
    }

    async confirmTossPaymentAndActivatePro({ paymentKey, orderId, amount, uid, planCode, planName, pendingIdToken }) {
      this._isConfirmingTossPayment = true;
      this.showTossPaymentResultModal({
        status: 'loading',
        title: '결제 승인 확인 중...',
        message: '토스페이먼츠 결제 내역을 최종 확인하고 있습니다. 잠시만 기다려 주세요.'
      });
      try {
        const confirmEndpoint = this.TOSS_CONFIRM_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/confirmTossPayment';
        const cfg = this.getSubscriptionQuotaConfig();
        const numAmount = Number(amount) || Number(cfg.proMonthlyPrice) || 4900;
        const resolvedPlanCode = this._inferPlanCodeFromOrder(orderId, numAmount, planCode);

        // 최신 Firebase ID 토큰을 최우선 확보하고, 아직 초기화 전일 때만 직전 토큰으로 폴백
        let idToken = '';
        if (typeof this._getFirebaseIdTokenForRest === 'function') {
          idToken = await this._getFirebaseIdTokenForRest(true);
        }
        if (!idToken && pendingIdToken) {
          idToken = String(pendingIdToken).trim();
        }

        if (paymentKey && orderId && confirmEndpoint) {
          const sendConfirmFetch = async (bearerToken) => {
            const headers = { 'Content-Type': 'application/json' };
            if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
            return await fetch(confirmEndpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                paymentKey: String(paymentKey),
                orderId: String(orderId),
                amount: numAmount,
                uid: uid || (this.cloudUser && this.cloudUser.uid) || '',
                planCode: resolvedPlanCode,
                planName: planName || 'Graphly 이용권',
                idToken: bearerToken
              })
            });
          };

          let res = await sendConfirmFetch(idToken);
          if (res.status === 401 && this._fbAuth && this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
            try {
              const refreshedToken = await this._fbAuth.currentUser.getIdToken(true);
              if (refreshedToken) {
                idToken = refreshedToken;
                res = await sendConfirmFetch(refreshedToken);
              }
            } catch (e) { }
          }

          const data = await res.json().catch(() => ({}));
          if (res.ok && data && data.ok === true) {
            try {
              localStorage.removeItem('graphly_pending_payment_confirm_v1');
              localStorage.removeItem('graphly_pending_payment_uid');
              localStorage.removeItem('graphly_pending_payment_plan_code');
              localStorage.removeItem('graphly_pending_payment_plan');
              localStorage.removeItem('graphly_pending_payment_id_token');
            } catch (e) { }

            const targetUid = uid || (this.cloudUser && this.cloudUser.uid) || '';
            const activatedTier = (data.tier === 'premium' || resolvedPlanCode.startsWith('PREMIUM_')) ? 'premium' : 'pro';
            const nextMeta = {
              uid: targetUid,
              tier: activatedTier,
              isPro: true,
              isPremium: activatedTier === 'premium',
              expiresAt: Number(data.expiresAt) || 0,
              proExpiresAt: Number(data.proExpiresAt) || Number(data.expiresAt) || 0,
              premiumExpiresAt: Number(data.premiumExpiresAt) || (activatedTier === 'premium' ? (Number(data.expiresAt) || 0) : 0),
              updatedAt: Date.now()
            };
            this._subStateMeta = nextMeta;
            if (targetUid) {
              this._writeStoredSubStateForUid(targetUid, nextMeta);
            }
            this.isProUser = true;
            if (this.cloudUser) {
              this.cloudUser.tier = activatedTier;
              this.cloudUser.isPro = true;
              this.cloudUser.isPremium = (activatedTier === 'premium');
              this._persistActiveCloudUserSession();
            }
            this.syncCloudAuthUI();
            this.syncProPricingModalUI();
            this.renderMyLibraryList();
            this.renderFuncList();
            if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
            this.showTossPaymentResultModal({
              status: 'success',
              tier: activatedTier,
              title: `Graphly ${activatedTier === 'premium' ? 'Premium' : 'Pro'} 결제가 완료되었습니다!`,
              message: `결제가 최종 승인되어 모든 ${activatedTier === 'premium' ? 'Premium' : 'Pro'} 기능이 즉시 활성화되었습니다.`,
              planName: (data && data.planName) || planName || `Graphly ${activatedTier === 'premium' ? 'Premium' : 'Pro'} 이용권`,
              amount: (data && data.amount) || numAmount,
              expiresAt: (activatedTier === 'premium' ? nextMeta.premiumExpiresAt : nextMeta.proExpiresAt) || nextMeta.expiresAt
            });
            return true;
          } else {
            if (res.status >= 400 && res.status < 500 && res.status !== 401) {
              try { localStorage.removeItem('graphly_pending_payment_confirm_v1'); } catch (e) { }
            }
            const errMsg = (data && data.message) ? data.message : '결제 최종 승인에 실패했습니다.';
            this.showTossPaymentResultModal({
              status: 'error',
              title: '결제 승인 실패',
              message: errMsg
            });
            return false;
          }
        } else {
          this.showTossPaymentResultModal({
            status: 'error',
            title: '결제 승인 연결 오류',
            message: '결제 승인 백엔드 서버 연결이 필요합니다.'
          });
          return false;
        }
      } catch (err) {
        this.showTossPaymentResultModal({
          status: 'error',
          title: '결제 승인 통신 오류',
          message: '일시적인 네트워크 지연이 발생했습니다. 페이지를 새로고침하면 결제가 자동으로 다시 확인됩니다. (문의: help@cubiolab.com)'
        });
      } finally {
        this._isConfirmingTossPayment = false;
      }
      return false;
    }

    initCustomGraphPresets() {
      this.getSubscriptionQuotaConfig();
      this.isProUser = false;
      this._subStateMeta = null;
      try {
        if (!this.cloudUser && typeof this._restoreActiveCloudUserSession === 'function') {
          this._restoreActiveCloudUserSession();
        }
        if (typeof window !== 'undefined' && window.location && window.location.search.includes('paymentStatus=success')) {
          const pendingUid = localStorage.getItem('graphly_pending_payment_uid') || (this.cloudUser && this.cloudUser.uid) || '';
          const pendingPlanCode = localStorage.getItem('graphly_pending_payment_plan_code') || '';
          const pendingPlanName = localStorage.getItem('graphly_pending_payment_plan') || 'Graphly 이용권';
          const pendingIdToken = localStorage.getItem('graphly_pending_payment_id_token') || '';
          const params = new URLSearchParams(window.location.search);
          const paidPaymentKey = params.get('paymentKey') || '';
          const paidOrderId = params.get('orderId') || '';
          const paidAmount = Number(params.get('amount')) || 0;
          const confirmPayload = {
            paymentKey: paidPaymentKey,
            orderId: paidOrderId,
            amount: paidAmount,
            uid: pendingUid,
            planCode: pendingPlanCode,
            planName: pendingPlanName,
            pendingIdToken: pendingIdToken,
            createdAt: Date.now()
          };
          if (paidPaymentKey && paidOrderId) {
            try {
              localStorage.setItem('graphly_pending_payment_confirm_v1', JSON.stringify(confirmPayload));
            } catch (e) { }
          }
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          }
          setTimeout(() => {
            this._restoreWorkspaceAfterTossRedirect().catch(() => { });
            this.confirmTossPaymentAndActivatePro(confirmPayload);
          }, 150);
        } else if (typeof window !== 'undefined' && window.location && window.location.search.includes('paymentStatus=fail')) {
          try {
            localStorage.removeItem('graphly_pending_payment_confirm_v1');
            localStorage.removeItem('graphly_pending_payment_uid');
            localStorage.removeItem('graphly_pending_payment_plan_code');
            localStorage.removeItem('graphly_pending_payment_plan');
            localStorage.removeItem('graphly_pending_payment_id_token');
          } catch (e) { }
          const params = new URLSearchParams(window.location.search);
          const failCode = params.get('code') || '';
          const failMsg = params.get('message') || '결제가 취소되었거나 완료되지 않았습니다.';
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          }
          setTimeout(() => {
            this._restoreWorkspaceAfterTossRedirect().catch(() => { });
            if (failCode !== 'PAY_PROCESS_CANCELED' && failCode !== 'USER_CANCEL') {
              this.showTossPaymentResultModal({
                status: 'error',
                title: '결제가 완료되지 않았습니다',
                message: failMsg
              });
            }
          }, 180);
        } else {
          // 승인 도중 새로고침되거나 네트워크가 잠시 끊겼던 미완료 결제건 자동 재시도 (30분 이내)
          try {
            const retryRaw = localStorage.getItem('graphly_pending_payment_confirm_v1');
            if (retryRaw) {
              const retryObj = JSON.parse(retryRaw);
              if (retryObj && retryObj.paymentKey && retryObj.orderId && (Date.now() - (Number(retryObj.createdAt) || 0) < 30 * 60 * 1000)) {
                setTimeout(() => {
                  this._restoreWorkspaceAfterTossRedirect().catch(() => { });
                  this.confirmTossPaymentAndActivatePro(retryObj);
                }, 250);
              } else {
                localStorage.removeItem('graphly_pending_payment_confirm_v1');
              }
            }
          } catch (e) { }
        }

        if (this.cloudUser && this.cloudUser.uid) {
          const storedV3 = this._readStoredSubStateForUid(this.cloudUser.uid);
          if (storedV3) {
            this._subStateMeta = this._extractSubMetaFromDoc(this.cloudUser.uid, storedV3);
          } else if (localStorage.getItem(this._getProStorageKeyForUid(this.cloudUser.uid)) === 'true') {
            this._subStateMeta = { uid: this.cloudUser.uid, tier: 'pro', isPro: true, isPremium: false, expiresAt: 0, proExpiresAt: 0, premiumExpiresAt: 0 };
          }
          const tier = this.getUserSubscriptionTier();
          this.isProUser = (tier !== 'free');
          this.cloudUser.tier = tier;
          this.cloudUser.isPro = this.isProUser;
          this.cloudUser.isPremium = (tier === 'premium');
        } else {
          this.isProUser = false;
        }
      } catch (e) { }
      this.customGraphPresets = [];
      this._renamingCustomGraphId = null;
      this._customGraphSearchQuery = '';
      this._loadCustomGraphsFromStorage();
    }

    _getCustomGraphsStorageKey() {
      const uid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest';
      return `graphly_custom_graphs_v1_${uid}`;
    }

    _loadCustomGraphsFromStorage() {
      // 비로그인(guest) 상태에서는 [⭐ 내 그래프] 프리셋을 비활성화하고 로그인한 계정에서만 로드
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.customGraphPresets = [];
        return;
      }
      try {
        const key = this._getCustomGraphsStorageKey();
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(parsed);
            return;
          }
        }
        // 로그인 직후 해당 계정 키에 데이터가 없으면 구버전 비로그인(guest) 시절 등록해둔 그래프를 1회 자동 승계하고 guest 키는 비움
        const guestRaw = localStorage.getItem('graphly_custom_graphs_v1_guest');
        if (guestRaw) {
          const guestParsed = JSON.parse(guestRaw);
          if (Array.isArray(guestParsed) && guestParsed.length > 0) {
            this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(guestParsed);
            localStorage.setItem(key, JSON.stringify(this.customGraphPresets));
            try { localStorage.removeItem('graphly_custom_graphs_v1_guest'); } catch (e2) { }
            return;
          }
        }
      } catch (e) { }
      this.customGraphPresets = [];
    }

    _canSyncCustomGraphsToFirestore() {
      return Boolean(
        this.cloudUser &&
        this.cloudUser.uid &&
        !this.cloudUser.isReviewerTest &&
        typeof window !== 'undefined' &&
        window.location &&
        /^https?:$/i.test(window.location.protocol)
      );
    }

    _saveCustomGraphsToStorage() {
      if (!this.cloudUser || !this.cloudUser.uid) return;
      if (Array.isArray(this.customGraphPresets)) {
        this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(this.customGraphPresets);
      }
      const rawJson = JSON.stringify(this.customGraphPresets || []);
      try {
        const key = this._getCustomGraphsStorageKey();
        localStorage.setItem(key, rawJson);
      } catch (e) { }
      if (this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestWriteSingleDoc === 'function') {
        const docId = `cg_user_${this.cloudUser.uid}`;
        const compressFn = (typeof this._compressJsonStringGzipBase64 === 'function')
          ? this._compressJsonStringGzipBase64.bind(this)
          : (async (s) => s);
        compressFn(rawJson)
          .then((packed) => this._firestoreRestWriteSingleDoc('user_custom_graphs', docId, packed))
          .catch(() => { });
      }
    }

    async onCustomGraphUserChanged() {
      this._loadCustomGraphsFromStorage();
      const curUid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest';
      const shouldFetchRemote = (this._lastSyncedCustomGraphsUid !== curUid);
      this._lastSyncedCustomGraphsUid = curUid;
      if (shouldFetchRemote && this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestReadDoc === 'function') {
        try {
          const idToken = await this._getFirebaseIdTokenForRest(true);
          if (idToken) {
            const docId = `cg_user_${this.cloudUser.uid}`;
            let remoteList = await this._firestoreRestReadDoc('user_custom_graphs', docId, true);
            if ((!Array.isArray(remoteList) || remoteList.length === 0) && this.cloudUser.email && this.cloudUser.email.includes('@')) {
              const altProvider = this.cloudUser.authProvider === 'google' ? 'email' : 'google';
              const siblingUid = this._getCanonicalUidForEmail(this.cloudUser.email, '', altProvider);
              if (siblingUid && siblingUid !== this.cloudUser.uid) {
                remoteList = await this._firestoreRestReadDoc('user_custom_graphs', `cg_user_${siblingUid}`, true);
              }
            }
            if (Array.isArray(remoteList) && remoteList.length > 0) {
              this.customGraphPresets = this._normalizeAndCapCustomGraphPresets([
                ...remoteList,
                ...(this.customGraphPresets || [])
              ]);
              try {
                localStorage.setItem(this._getCustomGraphsStorageKey(), JSON.stringify(this.customGraphPresets));
              } catch (e) { }
            }
          }
        } catch (e) { }
      }
      this.renderFuncList();
    }

    _buildSmartCustomGraphName() {
      if (!this.graphs || this.graphs.length === 0) return '나만의 그래프';
      const shortTypeNames = {
        '1st_linear': '일차',
        '2nd_quadratic': '이차',
        '3rd_monotonic': '삼차단조',
        '3rd_basic_cubic': '삼차기본',
        '3rd_normal': '삼차',
        '3rd_inflection': '삼차변곡',
        '4th_basic_bowl': '사차기본',
        '4th_skew': '사차비대칭U',
        '4th_symmetric': '사차W',
        '4th_asymmetric': '비대칭사차',
        '4th_inflection': '사차변곡',
        'exp_basic': '지수',
        'log_basic': '로그',
        'rational_basic': '유리',
        'sqrt_basic': '무리',
        'sin_1period': 'sin',
        'cos_1period': 'cos',
        'tan_1period': 'tan',
        'killer_exp_linear': 'x·eˣ',
        'killer_exp_quad': 'x²·eˣ',
        'killer_log_frac': 'lnx/x',
        'killer_frac_odd': 'x/(x²+1)',
        'geom_circle': '원',
        'geom_triangle': '삼각형',
        'geom_quad': '사각형',
        'general_expr': '수식'
      };
      const names = this.graphs.slice(0, 3).map(g => {
        const base = shortTypeNames[g.type] || (this.meta[g.type] && this.meta[g.type].name) || '함수';
        return g.isAbsolute ? `|${base}|` : base;
      });
      const joined = names.join('+') + (this.graphs.length > 3 ? ` 외` : '');
      if (this.usePiecewise && this.isPiecewisePeriodic) {
        const isStep = Math.abs(this.periodicStepY || 0) > 1e-3;
        return `${isStep ? '계단주기' : '주기반복'} (${joined})`;
      }
      if (this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
        return `구간분할 (${joined})`;
      }
      return joined;
    }

    _buildSmartCustomGraphBadge() {
      const parts = [];
      const gCount = (this.graphs || []).length;
      if (this.usePiecewise && this.isPiecewisePeriodic && this.piecewiseBoundaries && this.piecewiseBoundaries.length >= 2) {
        const T = Math.round((this.piecewiseBoundaries[this.piecewiseBoundaries.length - 1] - this.piecewiseBoundaries[0]) * 100) / 100;
        const q = Math.round((this.periodicStepY || 0) * 100) / 100;
        parts.push(Math.abs(q) > 1e-3 ? `🔁 주기 T=${T}·계단 q=${q > 0 ? '+' : ''}${q}` : `🔁 주기 T=${T}`);
      } else if (this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
        parts.push(`✂️ ${this.piecewiseBoundaries.length + 1}구간 분할`);
      }
      parts.push(`함수 ${gCount}개`);
      if ((this.graphs || []).some(g => g && g.isAbsolute)) {
        parts.push('|f(x)|');
      }
      if (this.dropLines && this.dropLines.length > 0) {
        parts.push(`수선 ${this.dropLines.length}`);
      }
      return parts.join(' · ');
    }

    _generateCustomGraphSvgThumb() {
      const W = 44;
      const H = 30;
      const xMin = -4.8;
      const xMax = 4.8;
      const steps = 48;
      const allY = [];
      const polylines = [];

      const evalPiecewiseAtX = (xVal) => {
        const boundaries = this.piecewiseBoundaries || [];
        const n = boundaries.length;
        if (n === 0 || !this.graphs || this.graphs.length === 0) return null;
        let evalX = xVal;
        let yOffset = 0;
        let rIdx = 0;
        if (this.isPiecewisePeriodic && n >= 2) {
          const b0 = boundaries[0];
          const bLast = boundaries[n - 1];
          const T = bLast - b0;
          if (T > 1e-4) {
            const k = Math.floor((xVal - b0) / T);
            evalX = xVal - k * T;
            if (evalX >= bLast - 1e-6) evalX = b0;
            if (evalX < b0) evalX = b0;
            yOffset = k * (this.periodicStepY || 0);
          }
          rIdx = 1;
          for (let i = 1; i < n - 1; i++) {
            if (evalX >= boundaries[i]) rIdx = i + 1;
          }
        } else {
          rIdx = 0;
          for (let i = 0; i < n; i++) {
            if (xVal >= boundaries[i]) rIdx = i + 1;
          }
        }
        const gIdx = (this.piecewiseFuncMap && this.piecewiseFuncMap[rIdx] !== undefined)
          ? this.piecewiseFuncMap[rIdx]
          : (rIdx % this.graphs.length);
        if (gIdx < 0 || !this.graphs[gIdx]) return null;
        const g = this.graphs[gIdx];
        const y = this.engine.evaluatePipeline(g, evalX) + yOffset;
        if (isNaN(y) || !isFinite(y) || Math.abs(y) > 80) return null;
        return { y, color: g.color || '#00d2d3', rIdx };
      };

      if (this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0) {
        let curPts = [];
        let prevRIdx = null;
        let curColor = '#00d2d3';
        for (let i = 0; i <= steps; i++) {
          const x = xMin + (xMax - xMin) * (i / steps);
          const res = evalPiecewiseAtX(x);
          if (!res) {
            if (curPts.length >= 2) polylines.push({ pts: curPts, color: curColor });
            curPts = [];
            prevRIdx = null;
            continue;
          }
          allY.push(res.y);
          if (prevRIdx !== null && res.rIdx !== prevRIdx) {
            if (curPts.length >= 2) polylines.push({ pts: curPts, color: curColor });
            curPts = [];
          }
          curColor = res.color;
          prevRIdx = res.rIdx;
          curPts.push({ x, y: res.y });
        }
        if (curPts.length >= 2) polylines.push({ pts: curPts, color: curColor });
      }

      (this.graphs || []).forEach(g => {
        if (!g) return;
        if (this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0 && !g.isIndependent && !g.isTransposedYX) {
          return;
        }
        const color = g.color || '#00d2d3';
        if (g.type === 'geom_circle') {
          if (Array.isArray(g.handles) && g.handles.length >= 2) {
            const cPos = this.engine.getHandleWorldPos(g, g.handles[0]);
            const rPos = this.engine.getHandleWorldPos(g, g.handles[1]);
            const rad = Math.hypot(rPos.x - cPos.x, rPos.y - cPos.y);
            if (rad > 1e-4) {
              const cPts = [];
              for (let k = 0; k <= 32; k++) {
                const ang = (k / 32) * Math.PI * 2;
                const px = cPos.x + rad * Math.cos(ang);
                const py = cPos.y + rad * Math.sin(ang);
                allY.push(py);
                cPts.push({ x: px, y: py });
              }
              polylines.push({ pts: cPts, color });
            }
          }
          return;
        }
        if (g.type === 'geom_triangle' || g.type === 'geom_quad') {
          if (Array.isArray(g.handles) && g.handles.length >= 2) {
            const pts = g.handles.map(h => this.engine.getHandleWorldPos(g, h));
            pts.forEach(p => allY.push(p.y));
            polylines.push({ pts: [...pts, pts[0]], color });
          }
          return;
        }
        if (g.type === '1st_linear' && Array.isArray(g.handles) && g.handles.length >= 2 && Math.abs(g.handles[1].x - g.handles[0].x) < 1e-4) {
          const lineConst = this.engine.baseXToWorldX(g, g.handles[0].x);
          if (g.isTransposedYX) {
            allY.push(lineConst);
            polylines.push({ pts: [{ x: xMin, y: lineConst }, { x: xMax, y: lineConst }], color });
          } else {
            polylines.push({ pts: [{ x: lineConst, y: -3 }, { x: lineConst, y: 3 }], color });
          }
          return;
        }
        let curPts = [];
        if (g.isTransposedYX) {
          const ySampleMin = -4.5;
          const ySampleMax = 4.5;
          for (let i = 0; i <= steps; i++) {
            const y = ySampleMin + (ySampleMax - ySampleMin) * (i / steps);
            const x = this.engine.evaluatePipeline(g, y);
            if (isNaN(x) || !isFinite(x) || Math.abs(x) > 80 || x < xMin - 2 || x > xMax + 2) {
              if (curPts.length >= 2) polylines.push({ pts: curPts, color });
              curPts = [];
              continue;
            }
            allY.push(y);
            curPts.push({ x, y });
          }
        } else {
          for (let i = 0; i <= steps; i++) {
            const x = xMin + (xMax - xMin) * (i / steps);
            const y = this.engine.evaluatePipeline(g, x);
            if (isNaN(y) || !isFinite(y) || Math.abs(y) > 80) {
              if (curPts.length >= 2) polylines.push({ pts: curPts, color });
              curPts = [];
              continue;
            }
            allY.push(y);
            curPts.push({ x, y });
          }
        }
        if (curPts.length >= 2) polylines.push({ pts: curPts, color });
      });

      let yMin = allY.length ? Math.min(...allY, -1.5) : -3;
      let yMax = allY.length ? Math.max(...allY, 1.5) : 3;
      if (yMax - yMin < 2.0) {
        const mid = (yMax + yMin) / 2;
        yMin = mid - 1.5;
        yMax = mid + 1.5;
      }

      const toSvgX = (x) => (3 + ((x - xMin) / (xMax - xMin)) * (W - 6)).toFixed(1);
      const toSvgY = (y) => (H - 3 - ((y - yMin) / (yMax - yMin)) * (H - 6)).toFixed(1);

      let boundaryLinesSvg = '';
      if (this.usePiecewise && Array.isArray(this.piecewiseBoundaries)) {
        this.piecewiseBoundaries.forEach(bx => {
          if (bx >= xMin && bx <= xMax) {
            const sx = toSvgX(bx);
            boundaryLinesSvg += `<line x1="${sx}" y1="2" x2="${sx}" y2="${H - 2}" stroke="#a29bfe" stroke-width="0.9" stroke-dasharray="2,2" opacity="0.75"/>`;
          }
        });
      }

      const pathsSvg = polylines.map(pl => {
        const d = pl.pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');
        return `<path d="${d}" fill="none" stroke="${pl.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      }).join('');

      const zeroY = toSvgY(0);
      const zeroX = toSvgX(0);
      const xAxisLine = (this.showXAxis !== false)
        ? `<line x1="2" y1="${zeroY}" x2="${W - 2}" y2="${zeroY}" stroke="currentColor" stroke-width="0.6" opacity="0.28"/>`
        : '';
      const yAxisLine = (this.showYAxis !== false)
        ? `<line x1="${zeroX}" y1="2" x2="${zeroX}" y2="${H - 2}" stroke="currentColor" stroke-width="0.6" opacity="0.28"/>`
        : '';
      const axesSvg = `${xAxisLine}${yAxisLine}`;

      return `<svg width="42" height="28" viewBox="0 0 ${W} ${H}" fill="none">${axesSvg}${boundaryLinesSvg}${pathsSvg}</svg>`;
    }

    saveCurrentGraphToCustomPresets(customName = '') {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.promptCloudLoginForLibrary('🔒 [⭐ 내 그래프] 프리셋 등록은 무료 로그인 후 이용할 수 있습니다.');
        return null;
      }

      let pipTargetForPreset = null;
      if (this.isGraphCovered) {
        if (typeof this._getTargetPipGraphCardForAxisOrPreset === 'function') {
          pipTargetForPreset = this._getTargetPipGraphCardForAxisOrPreset();
        }
        if (!pipTargetForPreset || !pipTargetForPreset.snap || !Array.isArray(pipTargetForPreset.snap.graphs) || pipTargetForPreset.snap.graphs.length === 0) {
          this.showToast('⚠️ 먼저 캔버스에 등록할 그래프를 그려주세요!');
          return null;
        }
      } else if (!this.graphs || this.graphs.length === 0) {
        this.showToast('⚠️ 먼저 캔버스에 등록할 그래프를 그려주세요!');
        return null;
      }

      // 👑 등급별(Free: 3개 / Pro: 30개 / Premium: 100개) 개수 제한 체크
      const quota = this.getCustomGraphQuotaStatus();
      if (quota.isReached) {
        if (quota.tier === 'premium') {
          this.showToast(`⚠️ [⭐ 내 그래프]는 최대 ${quota.maxLimit}개까지 저장할 수 있습니다. 안 쓰는 프리셋을 정리한 뒤 등록해 주세요!`);
        } else if (quota.tier === 'pro') {
          this.showToast(`💎 Pro 플랜은 [⭐ 내 그래프]를 최대 ${quota.maxLimit}개까지 등록할 수 있습니다. Premium 업그레이드 시 최대 ${quota.premiumLimit}개까지 등록됩니다!`);
          if (typeof this.openProPricingModal === 'function') {
            this.openProPricingModal('premium');
          }
        } else {
          this.showToast(`👑 무료 버전은 [⭐ 내 그래프]를 최대 ${quota.maxLimit}개까지 등록할 수 있습니다. Pro 업그레이드 시 최대 ${quota.proLimit}개(Premium ${quota.premiumLimit}개)까지 등록됩니다!`);
          if (typeof this.openProPricingModal === 'function') {
            this.openProPricingModal('pro');
          }
        }
        return null;
      }

      let cleanName = '';
      let badge = '';
      let svgThumb = '';
      let rawSnapObj = null;

      if (pipTargetForPreset && typeof this._withPipCardGraphState === 'function') {
        const cardW = pipTargetForPreset.snap._pipCardW || 430;
        const cardH = pipTargetForPreset.snap._pipCardH || 353;
        this._withPipCardGraphState(pipTargetForPreset.snap, cardW, cardH, () => {
          cleanName = (customName && String(customName).trim())
            ? String(customName).trim()
            : this._buildSmartCustomGraphName();
          badge = this._buildSmartCustomGraphBadge();
          svgThumb = this._generateCustomGraphSvgThumb();
          rawSnapObj = JSON.parse(this.getPureGraphSnapshot());
        });
      } else {
        cleanName = (customName && String(customName).trim())
          ? String(customName).trim()
          : this._buildSmartCustomGraphName();
        badge = this._buildSmartCustomGraphBadge();
        svgThumb = this._generateCustomGraphSvgThumb();
        rawSnapObj = JSON.parse(this.getPureGraphSnapshot());
      }
      rawSnapObj.graphInkStrokes = [];

      const newItem = {
        id: 'cg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        badge: badge,
        svgThumb: svgThumb,
        createdAt: Date.now(),
        snapshot: JSON.stringify(rawSnapObj)
      };

      if (!Array.isArray(this.customGraphPresets)) {
        this.customGraphPresets = [];
      }
      this.customGraphPresets.push(newItem);
      this._customGraphSearchQuery = '';
      this._saveCustomGraphsToStorage();

      this._currentCat = '⭐ 내 그래프';
      this.renderFuncList();
      setTimeout(() => {
        const scrollEl = document.querySelector('#funcGrid .custom-graph-scroll-list');
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        }
      }, 10);
      const savedIdx = this.customGraphPresets.findIndex(it => it && it.id === newItem.id);
      const assignedCode = 71 + (savedIdx >= 0 ? savedIdx : Math.max(0, this.customGraphPresets.length - 1));
      this.showToast(`⭐ [${assignedCode}] ${newItem.name} 프리셋이 등록되었습니다!`);
      return newItem;
    }

    loadCustomGraphPreset(presetId) {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.promptCloudLoginForLibrary('🔒 [⭐ 내 그래프] 프리셋은 무료 로그인 후 이용할 수 있습니다.');
        return false;
      }
      if (!Array.isArray(this.customGraphPresets)) return false;
      const idx = this.customGraphPresets.findIndex(it => it && it.id === presetId);
      if (idx === -1) return false;
      const item = this.customGraphPresets[idx];
      if (!item || !item.snapshot) return false;

      const cfg = this.getSubscriptionQuotaConfig();
      const quota = this.getCustomGraphQuotaStatus();
      if (cfg.enforceCustomGraphLimit && idx >= quota.maxLimit) {
        if (quota.tier === 'pro') {
          this.showToast(`🔒 Pro 플랜은 기본 ${quota.maxLimit}개까지 사용할 수 있습니다. Premium 업그레이드 시 보관된 ${this.customGraphPresets.length}개 프리셋이 즉시 잠금 해제됩니다!`);
          if (typeof this.openProPricingModal === 'function') {
            this.openProPricingModal('premium');
          }
        } else {
          this.showToast(`🔒 무료 버전은 기본 ${quota.maxLimit}개까지 사용할 수 있습니다. 이용권 업그레이드 시 보관된 ${this.customGraphPresets.length}개 프리셋이 잠금 해제됩니다!`);
          if (typeof this.openProPricingModal === 'function') {
            this.openProPricingModal('pro');
          }
        }
        return false;
      }

      if (this.isGraphCovered) {
        return this.loadCustomPresetToPipCardInBoardMode(item);
      }
      if (this._graphSessionArchived || this.pdfPageBoardData) {
        this.enterGraphModeFromBoard();
      }
      if (!this.showAxes) {
        this.showAxes = true;
        this.updateAxesUI();
      }

      this.pushHistoryState();
      this.applyPureGraphSnapshot(item.snapshot);
      if (this.graphColorMode === 'fixed' && this.fixedGraphColor && Array.isArray(this.graphs)) {
        this.graphs.forEach(g => { if (g) g.color = this.fixedGraphColor; });
        this.syncControls();
        this.renderLayerList();
      }
      if (typeof this.syncPeriodicUI === 'function') {
        this.syncPeriodicUI();
      }
      this.updatePwDescBadge();
      this.updateIntersections();

      if (this.isInkMode && this.activeInkTool !== 'select') {
        this.setActiveInkTool('select');
      }
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

      this.render();
      this.showToast(`⭐ [${item.name}] 그래프를 소환했습니다! 핸들을 드래그해 조절하세요.`);
      return true;
    }

    deleteCustomGraphPreset(presetId) {
      if (!Array.isArray(this.customGraphPresets)) return false;
      const idx = this.customGraphPresets.findIndex(it => it && it.id === presetId);
      if (idx === -1) return false;
      const removed = this.customGraphPresets.splice(idx, 1)[0];
      this._saveCustomGraphsToStorage();
      this.renderFuncList();
      this.showToast(`🗑️ [${removed ? removed.name : '그래프'}] 항목을 삭제했습니다.`);
      return true;
    }

    renameCustomGraphPreset(presetId, newName) {
      if (!Array.isArray(this.customGraphPresets)) return false;
      const item = this.customGraphPresets.find(it => it && it.id === presetId);
      if (!item) return false;
      const trimmed = String(newName || '').trim();
      if (trimmed) {
        item.name = trimmed;
        this._saveCustomGraphsToStorage();
        this.showToast(`✏️ [${trimmed}] 이름으로 변경되었습니다.`);
      }
      this._renamingCustomGraphId = null;
      this.renderFuncList();
      return true;
    }

    _matchesCustomGraphSearchQuery(item, rawQuery) {
      const q = String(rawQuery || '').trim().toLowerCase();
      if (!q) return true;
      const haystack = `${item && item.name ? item.name : ''} ${item && item.badge ? item.badge : ''}`.toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      for (let i = 0; i < tokens.length; i++) {
        if (!haystack.includes(tokens[i])) return false;
      }
      return true;
    }

    _populateCustomGraphScrollList(scrollList) {
      if (!scrollList) return;
      scrollList.innerHTML = '';

      if (!this.cloudUser || !this.cloudUser.uid) {
        const cfg = this.getSubscriptionQuotaConfig();
        const guestCard = document.createElement('div');
        guestCard.className = 'custom-graph-guest-notice';
        guestCard.innerHTML = `
        <div class="custom-graph-guest-title">🔒 무료 로그인 후 내 그래프를 등록하세요</div>
        <div class="custom-graph-guest-desc">무료 회원 ${cfg.freeMaxCustomGraphs || 3}개 · Pro ${cfg.proMaxCustomGraphs || 30}개 · Premium ${cfg.premiumMaxCustomGraphs || 100}개까지 계정에 자동 저장·동기화됩니다.</div>
      `;
        guestCard.onclick = (ev) => {
          ev.stopPropagation();
          this.promptCloudLoginForLibrary('🔑 무료 로그인 후 [⭐ 내 그래프] 프리셋을 등록해 보세요!');
        };
        scrollList.appendChild(guestCard);
        return;
      }

      if (!Array.isArray(this.customGraphPresets) || this.customGraphPresets.length === 0) {
        return;
      }

      const cfg = this.getSubscriptionQuotaConfig();
      const quota = this.getCustomGraphQuotaStatus();
      const rawQuery = String(this._customGraphSearchQuery || '').trim();
      const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));

      let renderedCount = 0;

      this.customGraphPresets.forEach((item, idx) => {
        if (!item) return;
        if (rawQuery && !this._matchesCustomGraphSearchQuery(item, rawQuery)) {
          return;
        }
        renderedCount++;

        const isLockedForTier = Boolean(cfg.enforceCustomGraphLimit && idx >= quota.maxLimit);
        const card = document.createElement('div');
        card.className = isLockedForTier ? 'custom-graph-card is-pro-locked' : 'custom-graph-card';
        card.setAttribute('data-custom-graph-id', item.id);
        card.dataset.customPresetId = item.id;

        const isRenaming = (this._renamingCustomGraphId === item.id);
        if (isRenaming) {
          card.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px; width:100%;">
            <input type="text" class="custom-graph-rename-input" value="${escapeHtml(item.name || '')}"
              style="flex:1; min-width:0; padding:4px 7px; border-radius:6px; border:1px solid #f59e0b; background:rgba(0,0,0,0.25); color:inherit; font-size:11.5px; font-weight:600;" />
            <button type="button" class="custom-graph-act-btn save" title="저장" style="width:auto; padding:0 8px; background:#f59e0b; color:#fff; font-weight:700;">확인</button>
          </div>
        `;
          const inp = card.querySelector('.custom-graph-rename-input');
          const btnSave = card.querySelector('.custom-graph-act-btn.save');
          if (inp) {
            inp.onclick = (ev) => ev.stopPropagation();
            inp.onkeydown = (ev) => {
              ev.stopPropagation();
              if (ev.key === 'Enter') {
                this.renameCustomGraphPreset(item.id, inp.value);
              } else if (ev.key === 'Escape') {
                this._renamingCustomGraphId = null;
                this.renderFuncList();
              }
            };
            setTimeout(() => { inp.focus(); inp.select(); }, 20);
          }
          if (btnSave) {
            btnSave.onclick = (ev) => {
              ev.stopPropagation();
              this.renameCustomGraphPreset(item.id, inp ? inp.value : item.name);
            };
          }
          scrollList.appendChild(card);
          return;
        }

        const safeTitle = escapeHtml(item.name || '나만의 그래프');
        const safeBadge = escapeHtml(item.badge || '커스텀 그래프');
        const safeSvgThumb = this._sanitizeCustomGraphSvgThumb(item.svgThumb);
        const lockTitle = quota.tier === 'pro' ? 'Premium 전용 보관 프리셋' : '상위 플랜 전용 보관 프리셋';
        const lockBadgeHtml = isLockedForTier ? `<span class="custom-graph-lock-tag" title="${lockTitle}">🔒</span>` : '';

        card.innerHTML = `
        <div class="custom-graph-card-left">
          <div class="custom-graph-thumb-box">${safeSvgThumb}</div>
          <div class="custom-graph-info">
            <div class="custom-graph-title">${lockBadgeHtml}${safeTitle}</div>
            <div class="custom-graph-meta">${safeBadge}</div>
          </div>
        </div>
        <div class="custom-graph-actions">
          <button type="button" class="custom-graph-act-btn edit" title="이름 변경">✏️</button>
          <button type="button" class="custom-graph-act-btn del" title="삭제">✕</button>
        </div>
      `;

        card.onclick = () => {
          this.loadCustomGraphPreset(item.id);
        };

        const btnEdit = card.querySelector('.custom-graph-act-btn.edit');
        if (btnEdit) {
          btnEdit.onclick = (ev) => {
            ev.stopPropagation();
            this._renamingCustomGraphId = item.id;
            this.renderFuncList();
          };
        }

        const btnDel = card.querySelector('.custom-graph-act-btn.del');
        if (btnDel) {
          btnDel.onclick = (ev) => {
            ev.stopPropagation();
            this.deleteCustomGraphPreset(item.id);
          };
        }

        scrollList.appendChild(card);
      });

      if (renderedCount === 0 && rawQuery) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'custom-graph-empty';
        emptyEl.textContent = '일치하는 프리셋이 없습니다.';
        scrollList.appendChild(emptyEl);
      }
    }

    renderCustomGraphPresetList(gridEl) {
      const grid = gridEl || document.getElementById('funcGrid');
      if (!grid) return;
      grid.innerHTML = '';

      const quota = this.getCustomGraphQuotaStatus();

      const headerEl = document.createElement('div');
      headerEl.className = 'func-cat-header func-preset-header';
      headerEl.innerHTML = `
      <span class="func-cat-title"><span>프리셋</span></span>
      <span class="custom-graph-quota-badge">${quota.badgeText}</span>
    `;
      grid.appendChild(headerEl);

      // 1번 고정 영역: [➕ 현재 그래프 등록] + 초슬림 실시간 검색창
      const regWrap = document.createElement('div');
      regWrap.className = 'custom-graph-register-wrap';

      const btnAdd = document.createElement('button');
      btnAdd.type = 'button';
      btnAdd.id = 'btnRegisterCurrentGraph';
      btnAdd.className = 'custom-graph-add-btn';
      btnAdd.innerHTML = `
      <span>➕ 현재 그래프 등록</span>
      <span style="font-size:10px; opacity:0.8; font-weight:600;">세트 통째 저장</span>
    `;
      btnAdd.onclick = (e) => {
        e.stopPropagation();
        this.saveCurrentGraphToCustomPresets();
      };
      regWrap.appendChild(btnAdd);

      const searchBox = document.createElement('div');
      searchBox.className = 'custom-graph-search-box';
      searchBox.innerHTML = `
      <span class="custom-graph-search-icon" aria-hidden="true">
        <svg width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7.5"></circle>
          <line x1="20.5" y1="20.5" x2="16.4" y2="16.4"></line>
        </svg>
      </span>
      <input type="text" id="inputCustomGraphSearch" class="custom-graph-search-input"
        placeholder="프리셋 검색" autocomplete="off" spellcheck="false" />
      <button type="button" id="btnClearCustomGraphSearch" class="custom-graph-search-clear" title="검색어 지우기" style="display: none;">✕</button>
    `;
      regWrap.appendChild(searchBox);
      grid.appendChild(regWrap);

      const scrollList = document.createElement('div');
      scrollList.className = 'custom-graph-scroll-list';
      grid.appendChild(scrollList);

      const inpSearch = searchBox.querySelector('#inputCustomGraphSearch');
      const btnClearSearch = searchBox.querySelector('#btnClearCustomGraphSearch');
      const curQuery = String(this._customGraphSearchQuery || '');
      if (inpSearch) {
        inpSearch.value = curQuery;
        if (btnClearSearch) {
          btnClearSearch.style.display = curQuery.length > 0 ? 'inline-flex' : 'none';
        }
        inpSearch.onclick = (ev) => ev.stopPropagation();
        inpSearch.onpointerdown = (ev) => ev.stopPropagation();
        inpSearch.oninput = () => {
          this._customGraphSearchQuery = inpSearch.value || '';
          if (btnClearSearch) {
            btnClearSearch.style.display = this._customGraphSearchQuery.length > 0 ? 'inline-flex' : 'none';
          }
          this._populateCustomGraphScrollList(scrollList);
        };
        inpSearch.onkeydown = (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Escape') {
            ev.preventDefault();
            if (inpSearch.value) {
              inpSearch.value = '';
              this._customGraphSearchQuery = '';
              if (btnClearSearch) btnClearSearch.style.display = 'none';
              this._populateCustomGraphScrollList(scrollList);
            } else {
              try { inpSearch.blur(); } catch (err) { }
            }
          } else if (ev.key === 'Enter' && !ev.isComposing) {
            ev.preventDefault();
            try { inpSearch.blur(); } catch (err) { }
          }
        };
      }
      if (btnClearSearch) {
        btnClearSearch.onclick = (ev) => {
          ev.stopPropagation();
          this._customGraphSearchQuery = '';
          if (inpSearch) {
            inpSearch.value = '';
            try { inpSearch.focus(); } catch (err) { }
          }
          btnClearSearch.style.display = 'none';
          this._populateCustomGraphScrollList(scrollList);
        };
      }

      try {
        this._populateCustomGraphScrollList(scrollList);
      } catch (err) {
        console.error('[Graphly] Custom graph preset list render error:', err);
      }
    }

    _hashLocalAccountPassword(rawPw) {
      const str = 'graphly_salt_v2::' + String(rawPw || '');
      let h1 = 0xdeadbeef ^ str.length;
      let h2 = 0x41c6ce57 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return 'h2_' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
    }

    _getLocalAccountsRegistry() {
      try {
        const raw = localStorage.getItem('graphly_local_accounts_v2');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            let scrubbed = false;
            Object.keys(parsed).forEach((k) => {
              if (parsed[k] && typeof parsed[k] === 'object' && 'passwordHash' in parsed[k]) {
                delete parsed[k].passwordHash;
                scrubbed = true;
              }
            });
            if (scrubbed) {
              try { localStorage.setItem('graphly_local_accounts_v2', JSON.stringify(parsed)); } catch (_) { }
            }
            return parsed;
          }
        }
      } catch (e) { }
      return {};
    }

    _saveLocalAccountsRegistry(reg) {
      try {
        const cleanReg = {};
        if (reg && typeof reg === 'object') {
          Object.keys(reg).forEach((k) => {
            if (reg[k] && typeof reg[k] === 'object') {
              const copy = { ...reg[k] };
              delete copy.passwordHash;
              cleanReg[k] = copy;
            }
          });
        }
        localStorage.setItem('graphly_local_accounts_v2', JSON.stringify(cleanReg));
      } catch (e) { }
    }

    _showEmailVerificationBanner(normEmail, customMsg = null) {
      this._pendingVerifyEmail = normEmail;
      const banner = document.getElementById('cloudEmailVerifyBanner');
      const lblMsg = document.getElementById('lblEmailVerifyPendingMsg');
      if (lblMsg) {
        lblMsg.textContent = customMsg || `📩 [${normEmail}] 메일함으로 인증 링크를 발송했습니다! 메일에서 인증 링크를 클릭한 뒤 아래 [인증 완료 확인]을 눌러주세요.`;
      }
      if (banner) banner.style.display = 'block';
    }

    async handleCloudEmailPasswordLogin() {
      const inpEmail = document.getElementById('inputCloudEmailId');
      const inpPw = document.getElementById('inputCloudEmailPw');
      const inpPwConfirm = document.getElementById('inputCloudEmailPwConfirm');
      const inpName = document.getElementById('inputCloudSignupName');

      const rawEmail = (inpEmail && inpEmail.value ? inpEmail.value : '').trim();
      const normEmail = rawEmail.toLowerCase();
      const pw = (inpPw && inpPw.value ? inpPw.value : '').trim();
      const isSignup = (this._cloudIdAuthTab === 'signup');

      if (!normEmail || !pw) {
        this.showToast('⚠️ 아이디(이메일 형식)와 비밀번호를 입력해 주세요.');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
        this.showToast('⚠️ 아이디는 이메일 형식(예: teacher@naver.com)으로 입력해 주세요.');
        return false;
      }

      const canonicalUid = this._getCanonicalUidForEmail(normEmail, '', 'email');
      const docId = 'acc_' + canonicalUid;
      const registry = this._getLocalAccountsRegistry();
      const canUseRemote = Boolean(typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol));

      if (canUseRemote && typeof this._ensureFirebaseInitialized === 'function') {
        this._ensureFirebaseInitialized();
      }
      if (canUseRemote && (!this._fbAuth || typeof this._fbAuth.signInWithEmailAndPassword !== 'function')) {
        this.showToast('⏳ 로그인 보안 모듈을 불러오는 중입니다. 1초 후 다시 시도해 주세요.');
        return false;
      }

      if (isSignup) {
        if (pw.length < 6) {
          this.showToast('⚠️ 비밀번호는 6자 이상 입력해 주세요.');
          return false;
        }
        const pwConfirm = (inpPwConfirm && inpPwConfirm.value ? inpPwConfirm.value : '').trim();
        if (pw !== pwConfirm) {
          this.showToast('⚠️ 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
          return false;
        }

        const existingAcc = registry[normEmail] || null;
        const rawDisplayName = (inpName && inpName.value ? inpName.value.trim() : '');
        const displayName = rawDisplayName || (rawEmail.split('@')[0] || '선생님');

        if (canUseRemote) {
          this._isExplicitAuthFlowInProgress = true;
          try {
            const cred = await this._fbAuth.createUserWithEmailAndPassword(normEmail, pw);
            if (cred && cred.user) {
              if (rawDisplayName && typeof cred.user.updateProfile === 'function') {
                await cred.user.updateProfile({ displayName }).catch(() => { });
              }
              if (typeof cred.user.sendEmailVerification === 'function') {
                await cred.user.sendEmailVerification();
              }
            }
          } catch (fbErr) {
            const code = (fbErr && fbErr.code) ? fbErr.code : '';
            if (code === 'auth/email-already-in-use') {
              try {
                const signCred = await this._fbAuth.signInWithEmailAndPassword(normEmail, pw);
                if (signCred && signCred.user) {
                  await signCred.user.reload();
                  if (signCred.user.emailVerified) {
                    const verifiedAcc = {
                      uid: canonicalUid,
                      authProvider: 'email',
                      providerLabel: '아이디 로그인',
                      loginId: normEmail,
                      displayName: signCred.user.displayName || displayName,
                      email: normEmail,
                      emailVerified: true,
                      verifiedAt: Date.now(),
                      createdAt: (existingAcc && existingAcc.createdAt) ? existingAcc.createdAt : Date.now()
                    };
                    registry[normEmail] = verifiedAcc;
                    this._saveLocalAccountsRegistry(registry);
                    if (typeof this._firestoreRestWriteSingleDoc === 'function') {
                      this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(verifiedAcc), { ownerUid: canonicalUid }).catch(() => { });
                    }
                    try { localStorage.setItem('graphly_last_auth_provider', 'email'); } catch (e) { }
                    this._applyLoggedInCloudUser({
                      uid: canonicalUid,
                      rawUid: String(signCred.user.uid || canonicalUid),
                      authProvider: 'email',
                      providerLabel: '아이디 로그인',
                      loginId: normEmail,
                      displayName: verifiedAcc.displayName,
                      email: normEmail,
                      emailVerified: true
                    }, true);
                    if (inpPw) inpPw.value = '';
                    if (inpPwConfirm) inpPwConfirm.value = '';
                    this.showToast(`✅ 이미 이메일 인증이 완료된 아이디입니다. 바로 로그인되었습니다!`);
                    return true;
                  } else if (typeof signCred.user.sendEmailVerification === 'function') {
                    await signCred.user.sendEmailVerification();
                  }
                }
              } catch (signErr) {
                this.showToast('⚠️ 이미 등록된 이메일입니다. [로그인] 탭에서 로그인하거나 [비밀번호 재설정]을 이용해 주세요.');
                return false;
              }
            } else if (code === 'auth/operation-not-allowed') {
              this.showToast('⚠️ Firebase 콘솔 [Authentication ➔ 로그인 방법]에서 [이메일/비밀번호] 사용 설정을 켜주세요.');
              return false;
            } else if (code === 'auth/invalid-email') {
              this.showToast('⚠️ 올바른 이메일 형식의 아이디를 입력해 주세요.');
              return false;
            } else {
              this.showToast('⚠️ 회원가입 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
              return false;
            }
          } finally {
            this._isExplicitAuthFlowInProgress = false;
          }
        }

        const pendingAccount = {
          uid: canonicalUid,
          authProvider: 'email',
          providerLabel: '아이디 로그인',
          loginId: normEmail,
          displayName: displayName,
          email: normEmail,
          emailVerified: false,
          verificationSentAt: Date.now(),
          createdAt: (existingAcc && existingAcc.createdAt) ? existingAcc.createdAt : Date.now()
        };

        registry[normEmail] = pendingAccount;
        this._saveLocalAccountsRegistry(registry);
        if (canUseRemote && typeof this._firestoreRestWriteSingleDoc === 'function') {
          this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(pendingAccount), { ownerUid: canonicalUid }).catch(() => { });
        }

        this._showEmailVerificationBanner(normEmail);
        this.showToast(`📩 [${normEmail}] 메일함으로 인증 링크를 발송했습니다! 인증 후 [인증 완료 확인]을 눌러주세요.`);
        return 'verification_pending';
      }

      // 아이디 로그인 모드: 상용 웹(http/https)에서는 100% Firebase Auth + 이메일 본인인증 통과 시에만 로그인 허용 (로컬 해시 우회 완전 제거)
      if (canUseRemote) {
        this._isExplicitAuthFlowInProgress = true;
        try {
          const cred = await this._fbAuth.signInWithEmailAndPassword(normEmail, pw);
          if (cred && cred.user) {
            await cred.user.reload();
            if (!cred.user.emailVerified) {
              this._showEmailVerificationBanner(
                normEmail,
                `⏳ [${normEmail}] 아이디는 아직 이메일 인증이 완료되지 않았습니다. 메일함에서 인증 링크를 클릭한 뒤 아래 [인증 완료 확인]을 눌러주세요.`
              );
              this.showToast('⏳ 이메일 인증을 완료해야 로그인할 수 있습니다.');
              return false;
            }
            let account = registry[normEmail] || null;
            if (!account && !cred.user.displayName && typeof this._firestoreRestReadDoc === 'function') {
              try {
                const remoteAcc = await this._firestoreRestReadDoc('user_accounts', docId, true);
                if (remoteAcc && remoteAcc.uid) account = remoteAcc;
              } catch (e) { }
            }
            const dispName = cred.user.displayName || (account && account.displayName) || (normEmail.split('@')[0] || '선생님');
            const syncedAcc = {
              uid: canonicalUid,
              authProvider: 'email',
              providerLabel: '아이디 로그인',
              loginId: normEmail,
              displayName: dispName,
              email: normEmail,
              emailVerified: true,
              verifiedAt: (account && account.verifiedAt) ? account.verifiedAt : Date.now(),
              createdAt: (account && account.createdAt) ? account.createdAt : Date.now()
            };
            registry[normEmail] = syncedAcc;
            this._saveLocalAccountsRegistry(registry);
            if (typeof this._firestoreRestWriteSingleDoc === 'function') {
              this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(syncedAcc), { ownerUid: canonicalUid }).catch(() => { });
            }
            try { localStorage.setItem('graphly_last_auth_provider', 'email'); } catch (e) { }
            this._applyLoggedInCloudUser({
              uid: canonicalUid,
              rawUid: String(cred.user.uid || canonicalUid),
              authProvider: 'email',
              providerLabel: '아이디 로그인',
              loginId: normEmail,
              displayName: dispName,
              email: normEmail,
              emailVerified: true
            }, true);
            if (inpPw) inpPw.value = '';
            this.showToast(`🎉 환영합니다, ${this.cloudUser.displayName}님! 로그인되었습니다.`);
            return true;
          }
          return false;
        } catch (fbErr) {
          const code = (fbErr && fbErr.code) ? fbErr.code : '';
          if (code === 'auth/user-not-found') {
            this.showToast('⚠️ 등록되지 않은 아이디입니다. [회원가입] 탭에서 먼저 가입해 주세요.');
            return false;
          }
          if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials') {
            this.showToast('⚠️ 아이디 또는 비밀번호가 일치하지 않습니다. (가입 전이라면 [회원가입] 탭을 이용해 주세요)');
            return false;
          }
          if (code === 'auth/too-many-requests') {
            this.showToast('⚠️ 로그인 시도가 너무 많습니다. 잠시 후 다시 시도하거나 [비밀번호 재설정]을 이용해 주세요.');
            return false;
          }
          if (code === 'auth/operation-not-allowed') {
            this.showToast('⚠️ Firebase 콘솔 [Authentication ➔ 로그인 방법]에서 [이메일/비밀번호]를 사용 설정해 주세요.');
            return false;
          }
          this.showToast('⚠️ 로그인 인증 서버와 연결할 수 없습니다. 네트워크 상태를 확인 후 다시 시도해 주세요.');
          return false;
        } finally {
          this._isExplicitAuthFlowInProgress = false;
        }
      }

      this.showToast('⚠️ 오프라인 파일(file://) 모드에서는 클라우드 로그인을 지원하지 않습니다.');
      return false;
    }

    async verifyPendingEmailAndLogin(explicitEmail = null) {
      const inpEmail = document.getElementById('inputCloudEmailId');
      const inpPw = document.getElementById('inputCloudEmailPw');
      const normEmail = String(explicitEmail || this._pendingVerifyEmail || (inpEmail && inpEmail.value) || '').trim().toLowerCase();
      if (!normEmail || !normEmail.includes('@')) {
        this.showToast('⚠️ 인증을 확인할 아이디(이메일 주소)를 먼저 입력해 주세요.');
        return false;
      }
      const canonicalUid = this._getCanonicalUidForEmail(normEmail, '', 'email');
      const docId = 'acc_' + canonicalUid;
      const registry = this._getLocalAccountsRegistry();
      const canUseRemote = Boolean(typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol));

      let account = registry[normEmail] || null;
      let verifiedRawUid = canonicalUid;

      if (canUseRemote && this._fbAuth) {
        this._isExplicitAuthFlowInProgress = true;
        try {
          if (!this._fbAuth.currentUser || String(this._fbAuth.currentUser.email || '').toLowerCase() !== normEmail) {
            const pwVal = (inpPw && inpPw.value ? inpPw.value : '').trim();
            if (pwVal && typeof this._fbAuth.signInWithEmailAndPassword === 'function') {
              await this._fbAuth.signInWithEmailAndPassword(normEmail, pwVal);
            }
          }
          if (!this._fbAuth.currentUser || String(this._fbAuth.currentUser.email || '').toLowerCase() !== normEmail) {
            this.showToast('⚠️ 비밀번호를 입력한 뒤 다시 [인증 완료 확인]을 눌러주세요.');
            return false;
          }
          await this._fbAuth.currentUser.reload();
          if (!this._fbAuth.currentUser.emailVerified) {
            this.showToast('⏳ 아직 메일함의 인증 링크가 클릭되지 않았습니다. 메일함(스팸함 포함)을 확인해 주세요.');
            return false;
          }
          verifiedRawUid = String(this._fbAuth.currentUser.uid || canonicalUid);
          if (!account && typeof this._firestoreRestReadDoc === 'function') {
            try {
              account = await this._firestoreRestReadDoc('user_accounts', docId, true);
            } catch (e) { }
          }
        } catch (e) {
          this.showToast('⚠️ 이메일 인증 상태를 확인할 수 없습니다. 비밀번호를 확인 후 다시 시도해 주세요.');
          return false;
        } finally {
          this._isExplicitAuthFlowInProgress = false;
        }
      } else {
        this.showToast('⚠️ 네트워크 연결 상태에서 이메일 인증을 확인해 주세요.');
        return false;
      }

      const cleanBaseAcc = account ? { ...account } : {};
      delete cleanBaseAcc.passwordHash;
      const updatedAccount = {
        ...cleanBaseAcc,
        uid: canonicalUid,
        authProvider: 'email',
        providerLabel: '아이디 로그인',
        loginId: normEmail,
        displayName: (this._fbAuth && this._fbAuth.currentUser && this._fbAuth.currentUser.displayName) || cleanBaseAcc.displayName || (normEmail.split('@')[0] || '선생님'),
        email: normEmail,
        emailVerified: true,
        verifiedAt: Date.now()
      };
      registry[normEmail] = updatedAccount;
      this._saveLocalAccountsRegistry(registry);
      if (canUseRemote && typeof this._firestoreRestWriteSingleDoc === 'function') {
        this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(updatedAccount), { ownerUid: canonicalUid }).catch(() => { });
      }

      const banner = document.getElementById('cloudEmailVerifyBanner');
      if (banner) banner.style.display = 'none';
      const inpPwConfirm = document.getElementById('inputCloudEmailPwConfirm');
      if (inpPw) inpPw.value = '';
      if (inpPwConfirm) inpPwConfirm.value = '';

      try { localStorage.setItem('graphly_last_auth_provider', 'email'); } catch (e) { }
      this._applyLoggedInCloudUser({
        uid: canonicalUid,
        rawUid: verifiedRawUid,
        authProvider: 'email',
        providerLabel: '아이디 로그인',
        loginId: normEmail,
        displayName: updatedAccount.displayName,
        email: normEmail,
        emailVerified: true
      }, true);
      this.showToast(`🎉 [${normEmail}] 이메일 인증 및 회원가입이 완료되어 바로 로그인되었습니다!`);
      return true;
    }

    async resendEmailVerificationLink() {
      const inpEmail = document.getElementById('inputCloudEmailId');
      const inpPw = document.getElementById('inputCloudEmailPw');
      const normEmail = String(this._pendingVerifyEmail || (inpEmail && inpEmail.value) || '').trim().toLowerCase();
      if (!normEmail || !normEmail.includes('@')) {
        this.showToast('⚠️ 인증메일을 재발송할 아이디(이메일 주소)를 입력해 주세요.');
        return false;
      }
      if (this._fbAuth) {
        try {
          if (!this._fbAuth.currentUser || String(this._fbAuth.currentUser.email || '').toLowerCase() !== normEmail) {
            const pwVal = (inpPw && inpPw.value ? inpPw.value : '').trim();
            if (pwVal && typeof this._fbAuth.signInWithEmailAndPassword === 'function') {
              await this._fbAuth.signInWithEmailAndPassword(normEmail, pwVal);
            }
          }
          if (this._fbAuth.currentUser && typeof this._fbAuth.currentUser.sendEmailVerification === 'function') {
            await this._fbAuth.currentUser.sendEmailVerification();
          }
        } catch (e) { }
      }
      this._showEmailVerificationBanner(normEmail);
      this.showToast(`📩 [${normEmail}] 메일함으로 인증 링크를 다시 발송했습니다.`);
      return true;
    }

    async handleResetEmailPassword() {
      const inpEmail = document.getElementById('inputCloudEmailId');
      const normEmail = String((inpEmail && inpEmail.value) || '').trim().toLowerCase();
      if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
        this.showToast('⚠️ 비밀번호 재설정 링크를 받을 아이디(이메일 주소)를 먼저 입력창에 적어주세요.');
        if (inpEmail) inpEmail.focus();
        return false;
      }
      if (this._fbAuth && typeof this._fbAuth.sendPasswordResetEmail === 'function') {
        try {
          await this._fbAuth.sendPasswordResetEmail(normEmail);
        } catch (e) { }
      }
      this.showToast(`📩 [${normEmail}] 메일함으로 비밀번호 재설정 링크를 발송했습니다.`);
      return true;
    }

    _applyLoggedInCloudUser(userInfo, registerFreshSessionLock = false) {
      if (!userInfo || (!userInfo.uid && !userInfo.email)) return;
      const normEmail = String(userInfo.email || userInfo.loginId || '').trim().toLowerCase();
      const provider = userInfo.authProvider === 'google' ? 'google' : 'email';
      const canonicalUid = this._getCanonicalUidForEmail(normEmail, userInfo.uid, provider);
      const prevUid = (this.cloudUser && this.cloudUser.uid) ? String(this.cloudUser.uid) : '';
      if (prevUid !== canonicalUid && typeof this._resetActiveShareSessionCache === 'function') {
        this._resetActiveShareSessionCache();
      }
      this.cloudUser = {
        uid: canonicalUid,
        rawUid: userInfo.rawUid || userInfo.uid || canonicalUid,
        authProvider: provider,
        providerLabel: provider === 'google' ? 'Google 로그인' : '아이디 로그인',
        loginId: normEmail || userInfo.uid,
        displayName: userInfo.displayName || (normEmail ? normEmail.split('@')[0] : '선생님'),
        email: normEmail,
        emailVerified: true
      };
      if (registerFreshSessionLock) {
        this._registerNewDeviceSessionLock(canonicalUid);
      }
      this._persistActiveCloudUserSession();
      this._loadMyLibraryCacheForCurrentUser();
      this.syncUserProSubscriptionFromCloud();
      this.syncCloudAuthUI();
      this.renderMyLibraryList();
      this.fetchMyLibraryFromCloud();
    }

    async handleCloudLogout(silentToast = false) {
      const prevUid = (this.cloudUser && this.cloudUser.uid) ? String(this.cloudUser.uid) : '';
      this._fbSignOutInProgress = true;
      if (this._fbAuth) {
        try {
          await this._fbAuth.signOut();
        } catch (e) { }
      }
      this._fbSignOutInProgress = false;
      if (prevUid && !silentToast) {
        try {
          localStorage.removeItem('graphly_device_session_' + prevUid);
          localStorage.removeItem('graphly_device_session_ts_' + prevUid);
        } catch (e) { }
      }
      this.cloudUser = null;
      this.myLibraryCache = [];
      this._subStateMeta = null;
      this.isProUser = false;
      if (typeof this._resetActiveShareSessionCache === 'function') {
        this._resetActiveShareSessionCache();
      }
      this._persistActiveCloudUserSession();
      const inpBuyerName = document.getElementById('inputProBuyerName');
      const inpBuyerEmail = document.getElementById('inputProBuyerEmail');
      if (inpBuyerName) inpBuyerName.value = '';
      if (inpBuyerEmail) inpBuyerEmail.value = '';
      this.syncCloudAuthUI();
      this.syncProPricingModalUI();
      this.renderMyLibraryList();
      this.renderFuncList();
      if (!silentToast) {
        this.showToast('👋 안전하게 로그아웃되었습니다. (공용 PC 보호 완료)');
      }
    }

    syncProPricingModalUI() {
      const cfg = this.getSubscriptionQuotaConfig();
      const tier = (this._selectedPricingTier === 'premium') ? 'premium' : 'pro';
      if (!this._tierBillingCycles) {
        this._tierBillingCycles = { pro: 'monthly', premium: 'monthly' };
      }
      if (
        (this._selectedBillingCycle === 'yearly' || this._selectedBillingCycle === 'monthly') &&
        this._selectedBillingCycle !== this._lastAppliedBillingCycle
      ) {
        this._tierBillingCycles[tier] = this._selectedBillingCycle;
      }

      const proCycle = (this._tierBillingCycles.pro === 'yearly') ? 'yearly' : 'monthly';
      const premCycle = (this._tierBillingCycles.premium === 'yearly') ? 'yearly' : 'monthly';
      const cycle = (tier === 'premium') ? premCycle : proCycle;

      this._selectedPricingTier = tier;
      this._selectedBillingCycle = cycle;
      this._lastAppliedBillingCycle = cycle;

      const isProYearly = (proCycle === 'yearly');
      const isPremYearly = (premCycle === 'yearly');
      const isSelectedYearly = (cycle === 'yearly');

      const proPrice = isProYearly ? (Number(cfg.proYearlyPrice) || 49000) : (Number(cfg.proMonthlyPrice) || 4900);
      const proRegPrice = isProYearly ? (Number(cfg.proYearlyRegularPrice) || 99000) : (Number(cfg.proMonthlyRegularPrice) || 9900);
      const premPrice = isPremYearly ? (Number(cfg.premiumYearlyPrice) || 99000) : (Number(cfg.premiumMonthlyPrice) || 9900);
      const premRegPrice = isPremYearly ? (Number(cfg.premiumYearlyRegularPrice) || 199000) : (Number(cfg.premiumMonthlyRegularPrice) || 19900);

      const calcDiscountPct = (sale, reg) => {
        if (!(reg > 0 && sale > 0 && sale < reg)) return 50;
        return Math.max(1, 100 - Math.ceil((sale / reg) * 100));
      };
      const proDiscountPct = calcDiscountPct(proPrice, proRegPrice);
      const premDiscountPct = calcDiscountPct(premPrice, premRegPrice);

      const proUnitText = isProYearly ? '/ 365일' : '/ 30일';
      const premUnitText = isPremYearly ? '/ 365일' : '/ 30일';
      const proPeriodNote = isProYearly ? '제공기간: 결제일로부터 365일 (단건)' : '제공기간: 결제일로부터 30일 (단건)';
      const premPeriodNote = isPremYearly ? '제공기간: 결제일로부터 365일 (단건)' : '제공기간: 결제일로부터 30일 (단건)';

      const selectedCode = tier === 'premium'
        ? (isSelectedYearly ? 'PREMIUM_1Y' : 'PREMIUM_1M')
        : (isSelectedYearly ? 'PRO_1Y' : 'PRO_1M');
      const selectedAmount = tier === 'premium' ? premPrice : proPrice;
      const selectedName = tier === 'premium'
        ? (isSelectedYearly ? 'Graphly Premium 1년 이용권 (365일)' : 'Graphly Premium 1개월 이용권 (30일)')
        : (isSelectedYearly ? 'Graphly Pro 1년 이용권 (365일)' : 'Graphly Pro 1개월 이용권 (30일)');

      this._selectedProPlan = {
        code: selectedCode,
        tier,
        cycle,
        name: selectedName,
        amount: selectedAmount
      };

      const btnProMonthly = document.getElementById('btnProCycleMonthly');
      const btnProYearly = document.getElementById('btnProCycleYearly');
      const btnPremMonthly = document.getElementById('btnPremiumCycleMonthly');
      const btnPremYearly = document.getElementById('btnPremiumCycleYearly');
      if (btnProMonthly) btnProMonthly.classList.toggle('active', !isProYearly);
      if (btnProYearly) btnProYearly.classList.toggle('active', isProYearly);
      if (btnPremMonthly) btnPremMonthly.classList.toggle('active', !isPremYearly);
      if (btnPremYearly) btnPremYearly.classList.toggle('active', isPremYearly);

      const btnMonthlyLegacy = document.getElementById('btnBillingCycleMonthly');
      const btnYearlyLegacy = document.getElementById('btnBillingCycleYearly');
      if (btnMonthlyLegacy) btnMonthlyLegacy.classList.toggle('active', !isSelectedYearly);
      if (btnYearlyLegacy) btnYearlyLegacy.classList.toggle('active', isSelectedYearly);

      const cardPro = document.getElementById('cardPlanPro');
      const cardPremium = document.getElementById('cardPlanPremium');
      if (cardPro) cardPro.classList.toggle('active', tier === 'pro');
      if (cardPremium) cardPremium.classList.toggle('active', tier === 'premium');

      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };
      setTxt('lblPlanFreeCloud', this.formatBytesHuman(cfg.freeMaxCloudBytes));
      setTxt('lblPlanFreeGraphs', `${cfg.freeMaxCustomGraphs}개`);
      setTxt('lblPlanFreeRec', `${Math.round((cfg.freeMaxRecordMs || 300000) / 60000)}분`);
      setTxt('lblPlanFreeShare', `1일 ${cfg.freeShareDailyLimit || 5}개 · ${cfg.freeShareExpiryDays || 3}일 만료`);

      setTxt('lblPlanProDiscountBadge', `${proDiscountPct}% 특별할인`);
      setTxt('lblPlanProDiscountPill', `-${proDiscountPct}%`);
      setTxt('lblPlanProRegularPrice', `정가 ${proRegPrice.toLocaleString('ko-KR')}원`);
      setTxt('lblPlanProPrice', `${proPrice.toLocaleString('ko-KR')}원`);
      setTxt('lblPlanProCycleUnit', proUnitText);
      setTxt('lblPlanProCloud', this.formatBytesHuman(cfg.proMaxCloudBytes));
      setTxt('lblPlanProGraphs', `${cfg.proMaxCustomGraphs}개`);
      setTxt('lblPlanProRec', `${Math.round((cfg.proMaxRecordMs || 3600000) / 60000)}분`);
      setTxt('lblPlanProShareDays', `${cfg.proShareExpiryDays || 7}일 만료`);
      setTxt('lblPlanProPeriodNote', proPeriodNote);
      setTxt('lblPlanProSelectState', tier === 'pro' ? '선택됨' : '선택하기');

      setTxt('lblPlanPremiumDiscountPill', `-${premDiscountPct}%`);
      setTxt('lblPlanPremiumRegularPrice', `정가 ${premRegPrice.toLocaleString('ko-KR')}원`);
      setTxt('lblPlanPremiumPrice', `${premPrice.toLocaleString('ko-KR')}원`);
      setTxt('lblPlanPremiumCycleUnit', premUnitText);
      setTxt('lblPlanPremiumCloud', this.formatBytesHuman(cfg.premiumMaxCloudBytes));
      setTxt('lblPlanPremiumGraphs', `${cfg.premiumMaxCustomGraphs}개`);
      setTxt('lblPlanPremiumRec', `${Math.round((cfg.premiumMaxRecordMs || 3600000) / 60000)}분`);
      setTxt('lblPlanPremiumShare', '영구 링크');
      setTxt('lblPlanPremiumPeriodNote', premPeriodNote);
      setTxt('lblPlanPremiumSelectState', tier === 'premium' ? '선택됨' : '선택하기');

      const activeUserTier = this.getUserSubscriptionTier();
      setTxt(
        'lblPlanFreeCurrentState',
        activeUserTier === 'free'
          ? (this.cloudUser ? '현재 이용 중' : '회원가입 즉시 무료 제공')
          : '기본 무료 등급'
      );

      const lblFinalAmt = document.getElementById('lblProModalFinalAmount');
      if (lblFinalAmt) {
        lblFinalAmt.textContent = `${selectedAmount.toLocaleString('ko-KR')}원`;
        lblFinalAmt.classList.toggle('is-premium-selected', tier === 'premium');
      }

      const tierTitle = tier === 'premium' ? 'Premium' : 'Pro';
      const cycleBadgeDays = isSelectedYearly ? '365일' : '30일';
      setTxt('lblProModalPayBtnBadge', `${tierTitle} ${cycleBadgeDays}`);

      const btnPayNow = document.getElementById('btnProModalPayNow');
      if (btnPayNow) {
        btnPayNow.classList.toggle('is-premium-selected', tier === 'premium');
      }
    }

    openProPricingModal(preferredTier = '') {
      const modalPro = document.getElementById('modalProPricing');
      if (!modalPro) return;
      if (this.virtualStylusEl && !this.isAudioPlaying) {
        this.virtualStylusEl.style.display = 'none';
      }
      if (preferredTier === 'premium' || preferredTier === 'pro') {
        this._selectedPricingTier = preferredTier;
      } else if (this.getUserSubscriptionTier() === 'pro') {
        this._selectedPricingTier = 'premium';
      }
      this.syncCloudAuthUI();
      this.syncProPricingModalUI();
      if (this.cloudUser) {
        const inpName = document.getElementById('inputProBuyerName');
        const inpEmail = document.getElementById('inputProBuyerEmail');
        if (inpName && !inpName.value && this.cloudUser.displayName) inpName.value = this.cloudUser.displayName;
        if (inpEmail && !inpEmail.value && this.cloudUser.email) inpEmail.value = this.cloudUser.email;
      }
      modalPro.classList.add('show');
    }

    showPricingLoginRequiredModal(customMsg = '') {
      if (typeof document === 'undefined' || !document.body) return;
      let backdrop = document.getElementById('modalPricingLoginNotice');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'modalPricingLoginNotice';
        backdrop.className = 'smart-modal-backdrop pricing-login-notice-backdrop';
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) backdrop.classList.remove('show');
        });
        document.body.appendChild(backdrop);
      }
      const escapeText = (str) => String(str || '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
      const descText = customMsg || '이용권은 로그인한 계정에 귀속됩니다. 먼저 로그인 후 결제를 진행해 주세요.';
      backdrop.innerHTML = `
        <div class="smart-modal-card pricing-login-notice-card" role="alertdialog" aria-modal="true" aria-labelledby="lblPricingLoginNoticeTitle">
          <div class="pricing-login-notice-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div id="lblPricingLoginNoticeTitle" class="pricing-login-notice-title">로그인이 필요합니다</div>
          <p class="pricing-login-notice-desc">${escapeText(descText)}</p>
          <div class="pricing-login-notice-actions">
            <button type="button" id="btnCancelPricingLoginNotice" class="pricing-login-notice-btn is-secondary">닫기</button>
            <button type="button" id="btnGoPricingLoginNotice" class="pricing-login-notice-btn is-primary">로그인하기</button>
          </div>
        </div>
      `;
      backdrop.classList.add('show');
      const btnCancel = backdrop.querySelector('#btnCancelPricingLoginNotice');
      const btnGo = backdrop.querySelector('#btnGoPricingLoginNotice');
      if (btnCancel) {
        btnCancel.onclick = () => {
          backdrop.classList.remove('show');
        };
      }
      if (btnGo) {
        btnGo.onclick = () => {
          backdrop.classList.remove('show');
          const modalPro = document.getElementById('modalProPricing');
          if (modalPro) modalPro.classList.remove('show');
          this.promptCloudLoginForLibrary('🔑 로그인 또는 회원가입 후 결제를 진행해 주세요.');
        };
      }
    }

    async requestTossPaymentFromStudio() {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.showPricingLoginRequiredModal('이용권은 로그인한 계정에 귀속됩니다. 먼저 로그인 후 결제를 진행해 주세요.');
        return false;
      }
      if (typeof window.TossPayments !== 'function') {
        this.showTossPaymentResultModal({
          status: 'warning',
          title: '결제 모듈 준비 중',
          message: '결제 모듈을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.'
        });
        return false;
      }
      if (typeof this._ensureFirebaseInitialized === 'function') {
        this._ensureFirebaseInitialized();
      }
      let idToken = '';
      if (typeof this._getFirebaseIdTokenForRest === 'function') {
        idToken = await this._getFirebaseIdTokenForRest(true);
      }
      if (!idToken && this._fbAuth && this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
        try {
          idToken = await this._fbAuth.currentUser.getIdToken(true);
        } catch (e) { }
      }
      if (!idToken) {
        this.showPricingLoginRequiredModal('안전한 결제 인증을 위해 다시 한 번 로그인 후 결제를 진행해 주세요.');
        return false;
      }

      this.syncProPricingModalUI();
      const cfg = this.getSubscriptionQuotaConfig();
      const plan = this._selectedProPlan || {
        code: 'PRO_1M',
        name: 'Graphly Pro 1개월 이용권 (30일)',
        amount: Number(cfg.proMonthlyPrice) || 4900
      };
      const planCode = this._inferPlanCodeFromOrder('', plan.amount, plan.code);
      const planMap = {
        PRO_1M: { amount: Number(cfg.proMonthlyPrice) || 4900, name: 'Graphly Pro 1개월 이용권 (30일)' },
        PRO_1Y: { amount: Number(cfg.proYearlyPrice) || 49000, name: 'Graphly Pro 1년 이용권 (365일)' },
        PREMIUM_1M: { amount: Number(cfg.premiumMonthlyPrice) || 9900, name: 'Graphly Premium 1개월 이용권 (30일)' },
        PREMIUM_1Y: { amount: Number(cfg.premiumYearlyPrice) || 99000, name: 'Graphly Premium 1년 이용권 (365일)' }
      };
      const chosen = planMap[planCode] || planMap.PRO_1M;
      const planAmount = chosen.amount;
      const planName = chosen.name;

      const inpName = document.getElementById('inputProBuyerName');
      const inpEmail = document.getElementById('inputProBuyerEmail');
      const customerName = (inpName && inpName.value ? inpName.value.trim() : '') || this.cloudUser.displayName || '회원구매자';
      const customerEmail = (inpEmail && inpEmail.value ? inpEmail.value.trim() : '') || this.cloudUser.email || 'help@cubiolab.com';
      const tossClientKey = 'live_ck_Z1aOwX7K8mBMQNM924ba3yQxzvNP';
      const tossPayments = window.TossPayments(tossClientKey);
      const cleanUid = String(this.cloudUser.uid).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
      const orderId = `GRAPHLY_${planCode}_${cleanUid}_${Date.now()}`;
      try {
        localStorage.setItem('graphly_pending_payment_uid', this.cloudUser.uid);
        localStorage.setItem('graphly_pending_payment_plan_code', planCode);
        localStorage.setItem('graphly_pending_payment_plan', planName);
        localStorage.setItem('graphly_pending_payment_id_token', idToken);
      } catch (e) { }

      // 결제 리다이렉트 전 현재 칠판·슬라이드 작업본을 IndexedDB에 안전 백업 (복귀 시 100% 무손실 복원!)
      await this._saveWorkspaceBeforeTossRedirect();

      const baseUrl = window.location.origin + window.location.pathname;
      this._isNavigatingForTossPayment = true;
      tossPayments.requestPayment('카드', {
        amount: planAmount,
        orderId: orderId,
        orderName: `${planName} [${this.cloudUser.email || this.cloudUser.uid}]`,
        customerName: customerName,
        customerEmail: customerEmail,
        successUrl: baseUrl + '?paymentStatus=success',
        failUrl: baseUrl + '?paymentStatus=fail'
      }).catch((err) => {
        this._isNavigatingForTossPayment = false;
        if (err && (err.code === 'USER_CANCEL' || err.code === 'PAY_PROCESS_CANCELED')) return;
        this.showTossPaymentResultModal({
          status: 'error',
          title: '결제 요청 안내',
          message: (err && err.message) ? err.message : '결제 요청 중 오류가 발생했습니다.'
        });
      });
      return true;
    }

    async handleCloudGoogleAuth() {
      if (this.cloudUser) {
        await this.handleCloudLogout();
        return;
      }
      const lblSettingsAcct = document.getElementById('lblSettingsAccountStatus');
      const showAccountInlineNotice = (msg, isError = false) => {
        if (lblSettingsAcct && !this.cloudUser) {
          lblSettingsAcct.style.display = 'flex';
          lblSettingsAcct.style.color = isError ? '#dc2626' : '#475569';
          lblSettingsAcct.style.fontSize = '11px';
          lblSettingsAcct.style.fontWeight = '600';
          lblSettingsAcct.textContent = msg;
        }
      };
      if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
        const fileMsg = '⚠️ 로컬 파일(file://)에서는 Google OAuth가 제한됩니다. graphly.net 또는 아이디 로그인을 이용해 주세요.';
        showAccountInlineNotice(fileMsg, true);
        this.showToast(fileMsg);
        return;
      }
      const inAppInfo = this._detectInAppBrowserInfo();
      if (inAppInfo.isInApp) {
        const curUrl = (typeof window !== 'undefined' && window.location) ? window.location.href : 'https://graphly.net';
        const boxEmailLogin = document.getElementById('cloudEmailLoginBox');
        if (boxEmailLogin) {
          boxEmailLogin.style.display = 'flex';
          this.switchCloudIdAuthTab('login');
        }
        if (inAppInfo.isAndroid) {
          try {
            window.location.href = 'intent://' + curUrl.replace(/^https?:\/\//i, '') + '#Intent;scheme=https;package=com.android.chrome;end';
          } catch (e) { }
        } else if (inAppInfo.isIOS && inAppInfo.isKakao) {
          try {
            window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(curUrl);
          } catch (e) { }
        }
        const guideMsg = `${inAppInfo.appName} 앱 내장 브라우저에서는 Google 보안 정책상 구글 로그인이 제한됩니다. 우측 메뉴(⋯)에서 [Safari / 외부 브라우저로 열기]를 누르시거나 아래 [아이디 로그인]을 이용해 주세요.`;
        showAccountInlineNotice(`⚠️ ${guideMsg}`, true);
        if (typeof this.showTossPaymentResultModal === 'function') {
          this.showTossPaymentResultModal({
            status: 'warning',
            title: '외부 브라우저(Safari · Chrome) 열기 안내',
            message: guideMsg
          });
        } else {
          this.showToast(`⚠️ ${guideMsg}`);
        }
        return;
      }
      if (typeof this._ensureFirebaseInitialized === 'function') {
        this._ensureFirebaseInitialized();
      }
      if (!window.firebase || !this._fbAuth) {
        showAccountInlineNotice('⏳ 구글 로그인 모듈을 불러오는 중입니다. 1초 후 다시 눌러주세요.', false);
        this.showToast('⚠️ 구글 로그인 모듈을 불러오는 중입니다. 잠시 후 다시 눌러주세요.');
        return;
      }
      const provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      showAccountInlineNotice('⏳ Google 로그인 창을 여는 중...', false);
      this._isExplicitAuthFlowInProgress = true;
      try { localStorage.setItem('graphly_last_auth_provider', 'google'); } catch (e) { }

      // iOS/iPadOS 홈화면 웹앱(PWA, navigator.standalone === true) 환경에서 Firebase SDK가
      // window.open 대신 분리된 <a target="_blank"> 합성 클릭 및 null 윈도우(new Rn(null))를 반환해
      // 팝업 로그인이 먹통이 되는 현상을 방지하기 위해 팝업 호출 순간 standalone 플래그를 우회
      let restoredStandaloneDesc = null;
      const hadStandaloneTrue = Boolean(typeof window !== 'undefined' && window.navigator && window.navigator.standalone === true);
      if (hadStandaloneTrue) {
        try {
          restoredStandaloneDesc = Object.getOwnPropertyDescriptor(window.navigator, 'standalone') ||
            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window.navigator), 'standalone');
          Object.defineProperty(window.navigator, 'standalone', {
            get: () => false,
            configurable: true
          });
        } catch (e) { }
      }

      try {
        const result = await this._fbAuth.signInWithPopup(provider);
        const authUser = (result && result.user) ? result.user : (this._fbAuth && this._fbAuth.currentUser ? this._fbAuth.currentUser : null);
        if (authUser) {
          if (lblSettingsAcct) {
            lblSettingsAcct.style.color = '';
            lblSettingsAcct.style.fontSize = '';
            lblSettingsAcct.style.fontWeight = '';
          }
          const normEmail = String(authUser.email || '').trim().toLowerCase();
          const canonicalUid = this._getCanonicalUidForEmail(normEmail, authUser.uid, 'google');
          try { localStorage.setItem('graphly_last_auth_provider', 'google'); } catch (e) { }
          this._applyLoggedInCloudUser({
            uid: canonicalUid,
            rawUid: String(authUser.uid || canonicalUid),
            authProvider: 'google',
            providerLabel: 'Google 로그인',
            loginId: normEmail || authUser.uid,
            displayName: authUser.displayName || (normEmail ? normEmail.split('@')[0] : '선생님'),
            email: normEmail,
            emailVerified: true
          }, true);
          this.showToast(`🎉 환영합니다, ${this.cloudUser.displayName}님! 클라우드 보관함이 동기화되었습니다.`);
        }
      } catch (err) {
        // 팝업 창 닫힘 이벤트 타이밍 차이로 catch로 넘어왔더라도 이미 Firebase 세션에 Google 계정이 인증 완료된 경우 정상 로그인 처리
        const fallbackUser = (this._fbAuth && this._fbAuth.currentUser) ? this._fbAuth.currentUser : null;
        const fallbackHasGoogle = Boolean(fallbackUser && Array.isArray(fallbackUser.providerData) && fallbackUser.providerData.some(p => p && p.providerId === 'google.com'));
        if (fallbackUser && fallbackHasGoogle) {
          if (lblSettingsAcct) {
            lblSettingsAcct.style.color = '';
            lblSettingsAcct.style.fontSize = '';
            lblSettingsAcct.style.fontWeight = '';
          }
          const normEmail = String(fallbackUser.email || '').trim().toLowerCase();
          const canonicalUid = this._getCanonicalUidForEmail(normEmail, fallbackUser.uid, 'google');
          try { localStorage.setItem('graphly_last_auth_provider', 'google'); } catch (e) { }
          this._applyLoggedInCloudUser({
            uid: canonicalUid,
            rawUid: String(fallbackUser.uid || canonicalUid),
            authProvider: 'google',
            providerLabel: 'Google 로그인',
            loginId: normEmail || fallbackUser.uid,
            displayName: fallbackUser.displayName || (normEmail ? normEmail.split('@')[0] : '선생님'),
            email: normEmail,
            emailVerified: true
          }, true);
          return;
        }

        const errCode = (err && err.code) ? String(err.code) : '';
        if (
          errCode === 'auth/popup-blocked' ||
          errCode === 'auth/operation-not-supported-in-this-environment' ||
          errCode === 'auth/web-storage-unsupported'
        ) {
          try {
            showAccountInlineNotice('🔄 Google 로그인 페이지로 이동합니다...', false);
            await this._fbAuth.signInWithRedirect(provider);
            return;
          } catch (redirErr) {
            showAccountInlineNotice('⚠️ 브라우저 팝업 차단을 해제하거나 아이디 로그인을 이용해 주세요.', true);
            return;
          }
        }
        if (errCode === 'auth/unauthorized-domain') {
          const curHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
          showAccountInlineNotice(`⚠️ 현재 접속 도메인(${curHost})이 Firebase 승인 도메인에 등록되지 않았습니다.`, true);
          return;
        }
        this.syncCloudAuthUI();
        if (errCode && errCode !== 'auth/popup-closed-by-user' && errCode !== 'auth/cancelled-popup-request') {
          showAccountInlineNotice(`⚠️ Google 로그인 오류 (${errCode}). 다시 시도하거나 아이디 로그인을 이용해 주세요.`, true);
        }
        this.showToast('⚠️ 구글 로그인 창이 닫혔거나 취소되었습니다.');
      } finally {
        this._isExplicitAuthFlowInProgress = false;
        if (hadStandaloneTrue) {
          try {
            if (restoredStandaloneDesc) {
              Object.defineProperty(window.navigator, 'standalone', restoredStandaloneDesc);
            } else {
              delete window.navigator.standalone;
            }
          } catch (e) { }
        }
      }
    }

    // 🌟 [필기 스트로크 부동소수점 좌표 경량화 (시각 오차 0.00px, JSON 용량 65% 절감)]
    _compactStrokesArray(strokes) {
      if (!Array.isArray(strokes) || strokes.length === 0) return [];
      const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
      const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
      const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
      const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
      const cloned = JSON.parse(JSON.stringify(strokes));
      for (let i = 0; i < cloned.length; i++) {
        const st = cloned[i];
        if (!st) continue;
        delete st._holdAnchorPx;
        delete st._lastMovePx;
        delete st._shapeHoldDetected;
        if (typeof st.tStart === 'number') st.tStart = Math.round(st.tStart);
        if (typeof st.tEnd === 'number') st.tEnd = Math.round(st.tEnd);
        if (typeof st.erasedAt === 'number') st.erasedAt = Math.round(st.erasedAt);
        if (typeof st.holdUntil === 'number') st.holdUntil = Math.round(st.holdUntil);
        if (typeof st.shapeSnapAt === 'number') st.shapeSnapAt = Math.round(st.shapeSnapAt);
        if (typeof st.zoom === 'number') st.zoom = r3(st.zoom);
        const isBoardCoord = Boolean(st.isBoard);
        if (Array.isArray(st.points)) {
          for (let j = 0; j < st.points.length; j++) {
            const pt = st.points[j];
            if (!pt) continue;
            if (pt.x !== undefined) pt.x = isBoardCoord ? r1(pt.x) : r3(pt.x);
            if (pt.y !== undefined) pt.y = isBoardCoord ? r1(pt.y) : r3(pt.y);
            if (pt.nx !== undefined) pt.nx = r4(pt.nx);
            if (pt.ny !== undefined) pt.ny = r4(pt.ny);
            if (pt.mx !== undefined) pt.mx = r3(pt.mx);
            if (pt.my !== undefined) pt.my = r3(pt.my);
            if (pt.p !== undefined) {
              const rp = r2(pt.p);
              if (Math.abs(rp - 0.5) < 0.005) {
                delete pt.p;
              } else {
                pt.p = rp;
              }
            }
            if (pt.t !== undefined) pt.t = Math.round(pt.t);
          }
        }
      }
      return cloned;
    }

    _getCompactHistoryObject() {
      const raw = JSON.parse(this.getHistorySnapshot());
      if (Array.isArray(raw.inkStrokes)) {
        raw.inkStrokes = this._compactStrokesArray(raw.inkStrokes);
      }
      if (Array.isArray(raw.graphs)) {
        raw.graphs.forEach(g => { if (g) delete g._screenPts; });
      }
      return raw;
    }

    // 🌟 [음성 싱크 패키지 초경량 델타 압축 & 중복 오디오 제거 엔진 (18MB ➔ ~0.5MB, 97% 다이어트)]
    _compactAudioSyncData(syncData) {
      if (!syncData || typeof syncData !== 'object') return null;
      this._expandAudioSyncData(syncData);
      const out = JSON.parse(JSON.stringify(syncData));
      delete out._expanded;

      // 1) 오디오 데이터 중복 제거: audioSegments[0].audioDataUrl가 있으면 최상위 audioDataUrl 중복 저장 생략
      if (Array.isArray(out.audioSegments) && out.audioSegments.length > 0 && out.audioSegments[0] && out.audioSegments[0].audioDataUrl) {
        out.audioDataUrl = '';
      }

      // 2) 레이저/지우개 스트로크 좌표 경량화
      out.laserStrokes = this._compactStrokesArray(out.laserStrokes || []);
      out.erasedStrokes = this._compactStrokesArray(out.erasedStrokes || []);

      // 3) 타임라인 state 키프레임 델타(Delta) 압축 및 커서 이벤트 경량화
      const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
      const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
      const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
      let lastState = out.initialState || null;
      if (Array.isArray(out.timeline)) {
        const compactTimeline = [];
        let lastCursorColor = '#00d2d3';
        let lastCursorKind = 'pen';
        for (let i = 0; i < out.timeline.length; i++) {
          const ev = out.timeline[i];
          if (!ev) continue;
          if (ev.type === 'state' && ev.state) {
            if (!lastState) {
              lastState = ev.state;
              compactTimeline.push({ t: Math.round(ev.t || 0), type: 'state', state: ev.state });
            } else {
              const delta = { _d: 1 };
              let changedCount = 0;
              const keys = Object.keys(ev.state);
              for (let kIdx = 0; kIdx < keys.length; kIdx++) {
                const k = keys[kIdx];
                const vCur = ev.state[k];
                const vPrev = lastState[k];
                if (typeof vCur === 'object' && vCur !== null) {
                  if (JSON.stringify(vCur) !== JSON.stringify(vPrev)) {
                    delta[k] = vCur;
                    changedCount++;
                  }
                } else if (vCur !== vPrev) {
                  delta[k] = vCur;
                  changedCount++;
                }
              }
              lastState = ev.state;
              if (changedCount > 0) {
                compactTimeline.push({ t: Math.round(ev.t || 0), type: 'state', state: delta });
              }
            }
          } else if (ev.type === 'cursor') {
            const cEv = { ...ev, t: Math.round(ev.t || 0) };
            if (typeof cEv.x === 'number') cEv.x = cEv.isBoard ? r1(cEv.x) : r3(cEv.x);
            if (typeof cEv.y === 'number') cEv.y = cEv.isBoard ? r1(cEv.y) : r3(cEv.y);
            if (typeof cEv.bx === 'number') cEv.bx = r1(cEv.bx);
            if (typeof cEv.by === 'number') cEv.by = r1(cEv.by);
            if (typeof cEv.nx === 'number') cEv.nx = r4(cEv.nx);
            if (typeof cEv.ny === 'number') cEv.ny = r4(cEv.ny);
            if (cEv.isBoard && typeof cEv.bx === 'number' && typeof cEv.x === 'number' && Math.abs(cEv.bx - cEv.x) < 0.05 && Math.abs(cEv.by - cEv.y) < 0.05) {
              delete cEv.bx;
              delete cEv.by;
            }
            if (cEv.color === lastCursorColor) {
              delete cEv.color;
            } else if (cEv.color) {
              lastCursorColor = cEv.color;
            }
            if (cEv.cursorKind === lastCursorKind) {
              delete cEv.cursorKind;
            } else if (cEv.cursorKind) {
              lastCursorKind = cEv.cursorKind;
            }
            if (!cEv.isDrawing) delete cEv.isDrawing;
            if (cEv.isBoard === false) delete cEv.isBoard;
            compactTimeline.push(cEv);
          } else {
            compactTimeline.push(ev);
          }
        }
        out.timeline = compactTimeline;
      }

      // 4) finalState도 마지막 타임라인 상태(lastState) 대비 변경된 필드만 델타 저장
      if (out.finalState && typeof out.finalState === 'object' && lastState && typeof lastState === 'object' && !out.finalState._d) {
        const fDelta = { _d: 1 };
        const fKeys = Object.keys(out.finalState);
        for (let kIdx = 0; kIdx < fKeys.length; kIdx++) {
          const k = fKeys[kIdx];
          const vCur = out.finalState[k];
          const vPrev = lastState[k];
          if (typeof vCur === 'object' && vCur !== null) {
            if (JSON.stringify(vCur) !== JSON.stringify(vPrev)) {
              fDelta[k] = vCur;
            }
          } else if (vCur !== vPrev) {
            fDelta[k] = vCur;
          }
        }
        out.finalState = fDelta;
      }

      out._compact = 1;
      return out;
    }

    _expandAudioSyncData(syncData) {
      if (!syncData || typeof syncData !== 'object') return syncData;
      if (!syncData.audioDataUrl && Array.isArray(syncData.audioSegments) && syncData.audioSegments[0] && syncData.audioSegments[0].audioDataUrl) {
        syncData.audioDataUrl = syncData.audioSegments[0].audioDataUrl;
      }
      if (syncData._expanded) return syncData;
      const hasDelta = Boolean(
        syncData._compact ||
        (syncData.finalState && syncData.finalState._d) ||
        (Array.isArray(syncData.timeline) && syncData.timeline.some(ev => ev && ev.type === 'state' && ev.state && ev.state._d))
      );
      if (hasDelta) {
        let runningState = syncData.initialState ? JSON.parse(JSON.stringify(syncData.initialState)) : {};
        let runningColor = '#00d2d3';
        let runningCursorKind = 'pen';
        if (Array.isArray(syncData.timeline)) {
          for (let i = 0; i < syncData.timeline.length; i++) {
            const ev = syncData.timeline[i];
            if (!ev) continue;
            if (ev.type === 'state' && ev.state) {
              if (ev.state._d) {
                const full = { ...runningState, ...ev.state };
                delete full._d;
                ev.state = JSON.parse(JSON.stringify(full));
              }
              runningState = ev.state;
            } else if (ev.type === 'cursor') {
              if (ev.color) {
                runningColor = ev.color;
              } else {
                ev.color = runningColor;
              }
              if (ev.cursorKind) {
                runningCursorKind = ev.cursorKind;
              } else {
                ev.cursorKind = runningCursorKind;
              }
              ev.isDrawing = Boolean(ev.isDrawing);
              if (!ev.uiScreen && !ev.cardKey && ev.isBoard === undefined) {
                ev.isBoard = false;
              }
              if (ev.isBoard && ev.bx === undefined && typeof ev.x === 'number') {
                ev.bx = ev.x;
                ev.by = ev.y;
              }
            }
          }
        }
        if (syncData.finalState && syncData.finalState._d) {
          const fullFinal = { ...runningState, ...syncData.finalState };
          delete fullFinal._d;
          syncData.finalState = JSON.parse(JSON.stringify(fullFinal));
        }
        delete syncData._compact;
      }
      try {
        Object.defineProperty(syncData, '_expanded', { value: true, enumerable: false, configurable: true, writable: true });
      } catch (e) { }
      return syncData;
    }

    // 현재 워크스페이스(판서 + 문제 카드 + #1,#2 그래프 카드 + 실시간 그래프)를 100% 직렬화 가능한 JSON 객체로 추출
    serializeFullSlideState(title = '') {
      const pWidget = document.getElementById('problemCardWidget');
      const pImg = document.getElementById('problemCardImg');
      const pTitle = document.getElementById('problemCardTitle');
      const pToggle = document.getElementById('iconCardToggle');
      const hasPrimaryProblem = Boolean(pWidget && this.problemCardData);

      const gWidget = document.getElementById('graphCardWidget');
      const gImg = document.getElementById('graphCardImg');
      const gTitle = document.getElementById('graphCardTitle');
      const gToggle = document.getElementById('iconGraphCardToggle');
      const hasPrimaryGraph = Boolean(gWidget && this._hasPrimaryGraphCard && this.graphCardData);
      if (hasPrimaryGraph && typeof this._getMutablePipCardSnapshot === 'function') {
        const livePrimarySnap = this._getMutablePipCardSnapshot('primary');
        if (livePrimarySnap) {
          const bodyEl = document.getElementById('graphCardBody');
          const cw = Math.max(160, Math.round(parseFloat(gWidget.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
          const ch = Math.max(60, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cw * (this.graphCardAspect || 0.82))));
          livePrimarySnap._isPipCardSnapshot = true;
          livePrimarySnap._pipCardW = cw;
          livePrimarySnap._pipCardH = ch;
          if (typeof this._buildFullGraphInkStrokesFromPipCard === 'function') {
            livePrimarySnap.graphInkStrokes = this._compactStrokesArray(this._buildFullGraphInkStrokesFromPipCard('primary'));
          }
          this._savePipCardSnapshot('primary', livePrimarySnap);
        }
      }

      const extraProblems = [];
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el && document.body.contains(c.el)) {
            const imgEl = c.el.querySelector('.problem-card-img');
            const titleEl = c.el.querySelector('.card-title-text');
            extraProblems.push({
              dataUrl: imgEl ? imgEl.src : '',
              cardW: parseFloat(c.el.style.width) || 460,
              titleText: titleEl ? titleEl.textContent : '문제',
              baseX: c.baseX,
              baseY: c.baseY,
              pdfAnchor: (c.el._pdfAnchor || c.pdfAnchor) ? { ...(c.el._pdfAnchor || c.pdfAnchor) } : null,
              isMin: Boolean(c.isMin),
              pipLocked: Boolean(c.el.classList.contains('pip-locked-mode')),
              pipStealth: Boolean(c.el.classList.contains('pip-stealth-locked')),
              isPdfPageCard: Boolean(c.isPdfPageCard),
              pdfPageNum: c.pdfPageNum || null,
              cardInkStrokes: this._compactStrokesArray(c.el._cardInkStrokes || []),
              cardStickers: JSON.parse(JSON.stringify(c.el._cardStickers || []))
            });
          }
        });
      }

      if (typeof this.flushPendingPipCardBakes === 'function') {
        this.flushPendingPipCardBakes();
      }
      const extraGraphs = [];
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && document.body.contains(c.el)) {
            if (typeof this._getMutablePipCardSnapshot === 'function') {
              const liveExtraSnap = this._getMutablePipCardSnapshot(c);
              if (liveExtraSnap) {
                const bodyEl = c.el.querySelector('.problem-card-body');
                const cw = Math.max(160, Math.round(parseFloat(c.el.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
                const ch = Math.max(60, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cw * (c.aspect || 0.82))));
                liveExtraSnap._isPipCardSnapshot = true;
                liveExtraSnap._pipCardW = cw;
                liveExtraSnap._pipCardH = ch;
                if (typeof this._buildFullGraphInkStrokesFromPipCard === 'function') {
                  liveExtraSnap.graphInkStrokes = this._compactStrokesArray(this._buildFullGraphInkStrokesFromPipCard(c));
                }
                this._savePipCardSnapshot(c, liveExtraSnap);
              }
            }
            const imgEl = c.el.querySelector('.problem-card-img');
            const titleEl = c.el.querySelector('.card-title-text');
            extraGraphs.push({
              dataUrl: imgEl ? imgEl.src : '',
              cardW: parseFloat(c.el.style.width) || 360,
              aspect: c.aspect || 0.65,
              titleText: titleEl ? titleEl.textContent : `#${c.caseIdx || 2}`,
              baseX: c.baseX,
              baseY: c.baseY,
              pdfAnchor: (c.el._pdfAnchor || c.pdfAnchor) ? { ...(c.el._pdfAnchor || c.pdfAnchor) } : null,
              isMin: Boolean(c.isMin),
              caseIdx: c.caseIdx || 2,
              graphSnapshot: c.graphSnapshot ? JSON.parse(JSON.stringify(c.graphSnapshot)) : null,
              cardInkStrokes: this._compactStrokesArray(c.el._cardInkStrokes || []),
              cardStickers: JSON.parse(JSON.stringify(c.el._cardStickers || []))
            });
          }
        });
      }

      const activePdfBoard = this.pdfPageBoardData || (this._suspendedPdfBoardState && this._suspendedPdfBoardState.pdfPageBoardData) || null;
      const slideObj = {
        version: '2.0',
        slideTitle: title || (hasPrimaryProblem && pTitle ? pTitle.textContent : '문항'),
        timestamp: Date.now(),
        historyJson: this._getCompactHistoryObject(),
        isGraphCovered: Boolean(this.isGraphCovered),
        coveredGraphStateBackup: this._coveredGraphStateBackup ? JSON.parse(JSON.stringify(this._coveredGraphStateBackup)) : null,
        savedLayer2BoardPan: this._savedLayer2BoardPan ? { ...this._savedLayer2BoardPan } : null,
        suspendedPdfBoardState: this._suspendedPdfBoardState ? {
          panX: this._suspendedPdfBoardState.panX,
          panY: this._suspendedPdfBoardState.panY,
          zoomLevel: this._suspendedPdfBoardState.zoomLevel,
          xSpan: this._suspendedPdfBoardState.xSpan,
          ySpan: this._suspendedPdfBoardState.ySpan
        } : null,
        retainedPdfAudioProbCard: Boolean(this._retainedPdfAudioProbCard),
        graphSessionArchived: Boolean(this._graphSessionArchived),
        graphCaseCounter: this._graphCaseCounter || 0,
        primaryProblemCard: hasPrimaryProblem ? {
          problemCardData: this.problemCardData ? { pageNum: this.problemCardData.pageNum } : null,
          problemCardAspect: this.problemCardAspect,
          isProblemCardMinimized: Boolean(this.isProblemCardMinimized),
          problemCardBaseX: this.problemCardBaseX,
          problemCardBaseY: this.problemCardBaseY,
          pdfAnchor: (pWidget._pdfAnchor || this.problemCardPdfAnchor) ? { ...(pWidget._pdfAnchor || this.problemCardPdfAnchor) } : null,
          problemInkStrokes: this._compactStrokesArray(this.problemInkStrokes || []),
          problemCardStickers: JSON.parse(JSON.stringify(this.problemCardStickers || [])),
          imgSrc: (pImg && pImg.src) ? pImg.src : (this.problemCardData && this.problemCardData.imgUrl ? this.problemCardData.imgUrl : ''),
          titleText: pTitle ? pTitle.textContent : '문제',
          toggleText: pToggle ? pToggle.textContent : '▾',
          minimized: pWidget.classList.contains('minimized'),
          pipLocked: pWidget.classList.contains('pip-locked-mode'),
          pipStealth: pWidget.classList.contains('pip-stealth-locked'),
          left: pWidget.style.left,
          top: pWidget.style.top,
          width: pWidget.style.width,
          zIndex: pWidget.style.zIndex,
          display: pWidget.style.display
        } : null,
        extraProblems,
        primaryGraphCard: hasPrimaryGraph ? {
          graphCardData: {},
          graphCardAspect: this.graphCardAspect,
          isGraphCardMinimized: Boolean(this.isGraphCardMinimized),
          graphCardBaseX: this.graphCardBaseX,
          graphCardBaseY: this.graphCardBaseY,
          pdfAnchor: (gWidget._pdfAnchor || this.graphCardPdfAnchor) ? { ...(gWidget._pdfAnchor || this.graphCardPdfAnchor) } : null,
          primaryGraphCardSnapshot: this.primaryGraphCardSnapshot ? JSON.parse(JSON.stringify(this.primaryGraphCardSnapshot)) : null,
          graphInkStrokes: this._compactStrokesArray(this.graphInkStrokes || []),
          graphCardStickers: JSON.parse(JSON.stringify(this.graphCardStickers || [])),
          imgSrc: gImg ? gImg.src : '',
          titleText: gTitle ? gTitle.textContent : '#1',
          toggleText: gToggle ? gToggle.textContent : '▾',
          minimized: gWidget.classList.contains('minimized'),
          left: gWidget.style.left,
          top: gWidget.style.top,
          width: gWidget.style.width,
          zIndex: gWidget.style.zIndex,
          display: gWidget.style.display
        } : null,
        extraGraphs,
        pdfPageBoardData: activePdfBoard ? {
          pageNum: activePdfBoard.pageNum,
          totalPages: activePdfBoard.totalPages,
          dataUrl: activePdfBoard.dataUrl ||
            (activePdfBoard.canvas && activePdfBoard.canvas._cachedDataUrl) ||
            (activePdfBoard.canvas && !activePdfBoard.canvas._evicted && activePdfBoard.canvas.width > 4
              ? (activePdfBoard.dataUrl = (activePdfBoard.canvas._cachedDataUrl = this.encodeCanvasSmartWebP(activePdfBoard.canvas, 0.78)))
              : ''),
          pixelW: activePdfBoard.pixelW || (activePdfBoard.canvas && !activePdfBoard.canvas._evicted && activePdfBoard.canvas.width > 4 ? activePdfBoard.canvas.width : 0),
          pixelH: activePdfBoard.pixelH || (activePdfBoard.canvas && !activePdfBoard.canvas._evicted && activePdfBoard.canvas.height > 4 ? activePdfBoard.canvas.height : 0),
          aspect: activePdfBoard.aspect,
          mathW: activePdfBoard.mathW,
          mathH: activePdfBoard.mathH,
          centerX: activePdfBoard.centerX,
          centerY: activePdfBoard.centerY,
          baseYSpan: activePdfBoard.baseYSpan
        } : null,
        audioSyncData: this.audioSyncData ? this._compactAudioSyncData(this.audioSyncData) : null
      };
      return slideObj;
    }

    // 직렬화된 슬라이드 JSON 객체를 현재 워크스페이스에 100% 무손실 복원
    deserializeFullSlideState(slideData) {
      if (!slideData) return;

      // 기존 추가 카드들 정리
      if (this.extraProblemCards && this.extraProblemCards.length > 0) {
        this.extraProblemCards.forEach(c => {
          if (c && c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
        });
        this.extraProblemCards = [];
      }
      if (this.extraGraphCards && this.extraGraphCards.length > 0) {
        this.extraGraphCards.forEach(c => {
          if (c && c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
        });
        this.extraGraphCards = [];
      }

      // 기본 히스토리 상태(판서 획, 텍스트, 뷰포트, 실시간 그래프) 복원
      if (slideData.historyJson) {
        this.restoreHistorySnapshot(slideData.historyJson);
      }

      // 1. 기본 문제 카드 복원
      const pWidget = document.getElementById('problemCardWidget');
      const pImg = document.getElementById('problemCardImg');
      const pTitle = document.getElementById('problemCardTitle');
      const pToggle = document.getElementById('iconCardToggle');
      if (slideData.primaryProblemCard && pWidget) {
        const pc = slideData.primaryProblemCard;
        this.problemCardData = { ...(pc.problemCardData || {}), imgUrl: pc.imgSrc || (pc.problemCardData && pc.problemCardData.imgUrl) || '' };
        this.problemCardAspect = pc.problemCardAspect || 0.65;
        this.isProblemCardMinimized = Boolean(pc.isProblemCardMinimized);
        this.problemCardBaseX = typeof pc.problemCardBaseX === 'number' ? pc.problemCardBaseX : 72;
        this.problemCardBaseY = typeof pc.problemCardBaseY === 'number' ? pc.problemCardBaseY : 18;
        this.problemCardPdfAnchor = pc.pdfAnchor ? { ...pc.pdfAnchor } : null;
        pWidget._pdfAnchor = this.problemCardPdfAnchor ? { ...this.problemCardPdfAnchor } : null;
        this.problemInkStrokes = JSON.parse(JSON.stringify(pc.problemInkStrokes || []));
        this.problemCardStickers = JSON.parse(JSON.stringify(pc.problemCardStickers || []));
        if (typeof pWidget._renderCardStickers === 'function') pWidget._renderCardStickers();
        const safePcImgSrc = (typeof this._sanitizeCardImageUrl === 'function')
          ? this._sanitizeCardImageUrl(pc.imgSrc || '')
          : (pc.imgSrc || '');
        if (safePcImgSrc) {
          const imgObj = new Image();
          imgObj.onload = () => {
            if (imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
              this.problemCardAspect = imgObj.naturalHeight / imgObj.naturalWidth;
              this.syncProblemCardRectFromWidget();
            }
          };
          imgObj.src = safePcImgSrc;
          this.problemCardImage = imgObj;
        } else {
          this.problemCardImage = null;
        }
        if (pImg) {
          if (pImg.src !== safePcImgSrc) {
            pImg.src = safePcImgSrc;
          } else if (this._isFixedReplayStageActive && this._isFixedReplayStageActive() && safePcImgSrc) {
            pImg.removeAttribute('src');
            pImg.src = safePcImgSrc;
          }
        }
        if (pTitle) pTitle.textContent = pc.titleText || '문제';
        if (pToggle) pToggle.textContent = pc.toggleText || (pc.minimized ? '▸' : '▾');
        pWidget.classList.toggle('minimized', Boolean(pc.minimized));
        pWidget.classList.add('pip-locked-mode');
        pWidget.classList.toggle('pip-stealth-locked', Boolean(pc.pipStealth && !pc.minimized));
        if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(pWidget);
        if (
          typeof this.scheduleProblemCardStealth === 'function' &&
          pWidget.classList.contains('pip-locked-mode') &&
          !pWidget.classList.contains('pip-stealth-locked') &&
          !pWidget.classList.contains('minimized')
        ) {
          this.scheduleProblemCardStealth(pWidget, 3000);
        }
        pWidget.style.transform = '';
        pWidget.style.left = pc.left || '72px';
        pWidget.style.top = pc.top || '18px';
        pWidget.style.width = pc.width || '520px';
        if (pc.zIndex) pWidget.style.zIndex = pc.zIndex;
        pWidget.style.display = pc.display || 'flex';
        this.syncProblemCardRectFromWidget();
        this.renderProblemCardCanvas();
      } else {
        this.closeProblemCard();
      }

      // 2. 추가 문제 카드 복원
      if (Array.isArray(slideData.extraProblems)) {
        slideData.extraProblems.forEach(ep => {
          this.spawnExtraProblemCard(ep.dataUrl, ep.pdfPageNum || 1, ep.cardW || 460, null, {
            customX: ep.baseX,
            customY: ep.baseY,
            customTitle: ep.titleText || '문제',
            startMinimized: ep.isMin,
            isPdfPageCard: ep.isPdfPageCard,
            pdfPageNum: ep.pdfPageNum
          });
          const createdProb = this.extraProblemCards[this.extraProblemCards.length - 1];
          if (createdProb && createdProb.el) {
            createdProb.pdfAnchor = ep.pdfAnchor ? { ...ep.pdfAnchor } : null;
            createdProb.el._pdfAnchor = createdProb.pdfAnchor ? { ...createdProb.pdfAnchor } : null;
            createdProb.el._cardInkStrokes = JSON.parse(JSON.stringify(ep.cardInkStrokes || []));
            createdProb.el._cardStickers = JSON.parse(JSON.stringify(ep.cardStickers || []));
            createdProb.el.classList.add('pip-locked-mode');
            createdProb.el.classList.toggle('pip-stealth-locked', Boolean(ep.pipStealth && !ep.isMin));
            if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(createdProb.el);
            if (
              typeof this.scheduleProblemCardStealth === 'function' &&
              createdProb.el.classList.contains('pip-locked-mode') &&
              !createdProb.el.classList.contains('pip-stealth-locked') &&
              !createdProb.el.classList.contains('minimized')
            ) {
              this.scheduleProblemCardStealth(createdProb.el, 3000);
            }
            if (typeof createdProb.el._renderCardInkCanvas === 'function') createdProb.el._renderCardInkCanvas();
            if (typeof createdProb.el._renderCardStickers === 'function') createdProb.el._renderCardStickers();
          }
        });
      }

      // 3. 기본 그래프 보관 카드(#1) 복원
      const gWidget = document.getElementById('graphCardWidget');
      const gImg = document.getElementById('graphCardImg');
      const gTitle = document.getElementById('graphCardTitle');
      const gToggle = document.getElementById('iconGraphCardToggle');
      if (slideData.primaryGraphCard && gWidget) {
        const gc = slideData.primaryGraphCard;
        this._hasPrimaryGraphCard = true;
        const rawGcImgSrc = gc.imgSrc || (gc.graphCardData && gc.graphCardData.dataUrl) || '';
        const safeGcImgSrc = (typeof this._sanitizeCardImageUrl === 'function')
          ? this._sanitizeCardImageUrl(rawGcImgSrc)
          : rawGcImgSrc;
        this.graphCardData = { ...(gc.graphCardData || {}), dataUrl: safeGcImgSrc };
        this.graphCardAspect = gc.graphCardAspect || 0.65;
        this.isGraphCardMinimized = Boolean(gc.isGraphCardMinimized);
        this.graphCardBaseX = typeof gc.graphCardBaseX === 'number' ? gc.graphCardBaseX : 580;
        this.graphCardBaseY = typeof gc.graphCardBaseY === 'number' ? gc.graphCardBaseY : 18;
        this.graphCardPdfAnchor = gc.pdfAnchor ? { ...gc.pdfAnchor } : null;
        gWidget._pdfAnchor = this.graphCardPdfAnchor ? { ...this.graphCardPdfAnchor } : null;
        this.primaryGraphCardSnapshot = gc.primaryGraphCardSnapshot ? JSON.parse(JSON.stringify(gc.primaryGraphCardSnapshot)) : null;
        gWidget._pipSnapObj = null;
        gWidget._pipSnapRawRef = null;
        this.graphInkStrokes = JSON.parse(JSON.stringify(gc.graphInkStrokes || []));
        this.graphCardStickers = JSON.parse(JSON.stringify(gc.graphCardStickers || []));
        if (typeof gWidget._renderCardStickers === 'function') gWidget._renderCardStickers();
        if (safeGcImgSrc) {
          const gImgObj = new Image();
          gImgObj.src = safeGcImgSrc;
          this.graphCardImage = gImgObj;
        } else {
          this.graphCardImage = null;
        }
        if (gImg) gImg.src = safeGcImgSrc;
        if (gTitle) gTitle.textContent = gc.titleText || '#1';
        if (gToggle) gToggle.textContent = gc.toggleText || (gc.minimized ? '▸' : '▾');
        gWidget.classList.toggle('minimized', Boolean(gc.minimized));
        gWidget.style.left = gc.left || '580px';
        gWidget.style.top = gc.top || '18px';
        gWidget.style.width = gc.width || '400px';
        if (gc.zIndex) gWidget.style.zIndex = gc.zIndex;
        gWidget.style.display = gc.display || 'flex';
        this.syncGraphCardRectFromWidget();
        const restoredPrimarySnap = this._getMutablePipCardSnapshot('primary');
        if (restoredPrimarySnap && restoredPrimarySnap.isPipLocked) {
          this.schedulePipGraphCardStealth('primary', 0);
        } else {
          this.clearPipGraphCardStealthTimer('primary');
          gWidget.classList.remove('pip-locked-mode', 'pip-stealth-locked');
        }
      } else {
        this._hasPrimaryGraphCard = false;
        this.graphCardData = null;
        this.graphCardRect = null;
        this.graphCardPdfAnchor = null;
        this.graphInkStrokes = [];
        if (gWidget) {
          this.clearPipGraphCardStealthTimer('primary');
          gWidget._pdfAnchor = null;
          gWidget._pipSnapObj = null;
          gWidget._pipSnapRawRef = null;
          gWidget.classList.remove('pip-locked-mode', 'pip-stealth-locked');
          gWidget.style.display = 'none';
        }
      }

      // 4. 추가 그래프 보관 카드(#2, #3...) 복원
      if (Array.isArray(slideData.extraGraphs)) {
        slideData.extraGraphs.forEach(eg => {
          this.spawnExtraGraphArchiveCard(eg.dataUrl, eg.cardW || 360, eg.aspect || 0.65, eg.graphSnapshot || null);
          const created = this.extraGraphCards[this.extraGraphCards.length - 1];
          if (created && created.el) {
            created.el._cardInkStrokes = JSON.parse(JSON.stringify(eg.cardInkStrokes || []));
            created.el._cardStickers = JSON.parse(JSON.stringify(eg.cardStickers || []));
            if (typeof created.el._renderCardInkCanvas === 'function') created.el._renderCardInkCanvas();
            if (typeof created.el._renderCardStickers === 'function') created.el._renderCardStickers();
            created.baseX = eg.baseX;
            created.baseY = eg.baseY;
            created.pdfAnchor = eg.pdfAnchor ? { ...eg.pdfAnchor } : null;
            created.el._pdfAnchor = created.pdfAnchor ? { ...created.pdfAnchor } : null;
            created.el.style.left = `${Math.round(eg.baseX)}px`;
            created.el.style.top = `${Math.round(eg.baseY)}px`;
            if (eg.isMin) {
              created.isMin = true;
              created.el.classList.add('minimized');
              const chev = created.el.querySelector('.card-fold-chevron');
              if (chev) chev.textContent = '▸';
            }
            const restoredExtraSnap = this._getMutablePipCardSnapshot(created);
            if (restoredExtraSnap && restoredExtraSnap.isPipLocked) {
              this.schedulePipGraphCardStealth(created, 0);
            }
          }
        });
      }

      this._graphCaseCounter = slideData.graphCaseCounter || 0;
      this.isGraphCovered = slideData.isGraphCovered !== undefined ? Boolean(slideData.isGraphCovered) : true;
      this._coveredGraphStateBackup = slideData.coveredGraphStateBackup ? JSON.parse(JSON.stringify(slideData.coveredGraphStateBackup)) : null;
      this._savedLayer2BoardPan = slideData.savedLayer2BoardPan ? { ...slideData.savedLayer2BoardPan } : null;
      this._retainedPdfAudioProbCard = Boolean(slideData.retainedPdfAudioProbCard);
      this._graphSessionArchived = Boolean(slideData.graphSessionArchived);

      if (!this.isGraphCovered) {
        if (pWidget) pWidget.style.display = 'none';
        if (this.extraProblemCards) {
          this.extraProblemCards.forEach(c => { if (c && c.el) c.el.style.display = 'none'; });
        }
        if (gWidget) gWidget.style.display = 'none';
        if (this.extraGraphCards) {
          this.extraGraphCards.forEach(c => { if (c && c.el) c.el.style.display = 'none'; });
        }
      } else if (pWidget && this.problemCardData) {
        pWidget.style.display = this._retainedPdfAudioProbCard ? 'none' : 'flex';
      }

      if (slideData.pdfPageBoardData) {
        const pbd = { ...slideData.pdfPageBoardData };
        if (pbd.dataUrl && typeof this._sanitizeCardImageUrl === 'function') {
          pbd.dataUrl = this._sanitizeCardImageUrl(pbd.dataUrl);
        }
        const isValidCv = (cv) => (typeof this._isValidPdfBoardCanvas === 'function')
          ? this._isValidPdfBoardCanvas(cv)
          : Boolean(cv && typeof cv.getContext === 'function' && !cv._evicted && cv.width > 4 && cv.height > 4);
        const validDirectCanvas = isValidCv(pbd.canvas) ? pbd.canvas : null;
        const cachedCanvas = validDirectCanvas || ((typeof this._getPdfPageCanvasFromCache === 'function')
          ? this._getPdfPageCanvasFromCache(pbd.pageNum, pbd.dataUrl)
          : ((this._pdfPageCanvasCache && this._pdfPageCanvasCacheDoc === this.pdfDoc && pbd.pageNum && isValidCv(this._pdfPageCanvasCache[pbd.pageNum]))
            ? this._pdfPageCanvasCache[pbd.pageNum]
            : null));
        pbd.canvas = cachedCanvas || null;
        if (!pbd.canvas && pbd.dataUrl) {
          if (typeof this._ensurePdfBoardCanvasFromDataUrl === 'function') {
            this._ensurePdfBoardCanvasFromDataUrl(pbd);
          } else {
            const imgObj = new Image();
            imgObj.onload = () => {
              if (!isValidCv(pbd.canvas)) {
                const offC = document.createElement('canvas');
                offC.width = imgObj.naturalWidth || pbd.pixelW || 1200;
                offC.height = imgObj.naturalHeight || pbd.pixelH || 1680;
                const offCtx = offC.getContext('2d');
                if (offCtx) offCtx.drawImage(imgObj, 0, 0);
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
              }
              this.requestRender();
            };
            imgObj.src = pbd.dataUrl;
            pbd.img = imgObj;
          }
        }
        if (this.isGraphCovered) {
          this.pdfPageBoardData = pbd;
          this._suspendedPdfBoardState = null;
        } else {
          this.pdfPageBoardData = null;
          this._suspendedPdfBoardState = {
            ...(slideData.suspendedPdfBoardState || {
              panX: 0,
              panY: 0,
              zoomLevel: 1.0,
              xSpan: 11.5,
              ySpan: pbd.baseYSpan || 8.4
            }),
            pdfPageBoardData: pbd
          };
        }
      } else {
        this.pdfPageBoardData = null;
        this._suspendedPdfBoardState = null;
        this._lastPdfPageScreenRect = null;
      }

      if (!this._isApplyingAudioTimelineState) {
        this.stopAudioPlayback(false);
        this.audioSyncData = slideData.audioSyncData
          ? this._expandAudioSyncData(JSON.parse(JSON.stringify(slideData.audioSyncData)))
          : null;
        if (!this._isCapturingExportSnapshots) {
          const hasLoadedAudio = Boolean(this.audioSyncData && this.audioSyncData.durationMs > 0);
          this._isAudioSyncPlayerVisible = Boolean(this.isStudentAudioVideoOnlyMode && hasLoadedAudio);
          if (hasLoadedAudio) {
            this.audioPlayCurrentMs = 0;
            this._lastAppliedAudioStateObj = null;
            this._replayInkBakeKey = '';
            if (this.isStudentAudioVideoOnlyMode) {
              this._isAudioReplayActive = true;
              document.body.classList.add('audio-replay-active');
              if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();
              this._applyAudioTimelineStateAt(0);
            } else {
              this._isAudioReplayActive = false;
              document.body.classList.remove('audio-replay-active');
              if (this.audioSyncData.finalState) {
                this._applyAudioWorkspaceKeyframe(this.audioSyncData.finalState);
              }
            }
          }
        }
        this.syncAudioRecordUI();
      }

      this.updateProblemCardPosition();
      this.syncWorkspaceModeUI();
      this.syncGraphSnapBarUI();
      this._inkBakeDirty = true;
      this.updateIntersections();
      this.render();
    }

    _buildSlideSummaryBadge(slideData) {
      if (!slideData) return '빈 캔버스';
      const parts = [];
      let gCount = 0;
      try {
        const h = typeof slideData.historyJson === 'string' ? JSON.parse(slideData.historyJson) : slideData.historyJson;
        if (h && Array.isArray(h.graphs)) gCount = h.graphs.length;
      } catch (e) { }
      if (gCount === 0 && slideData.coveredGraphStateBackup && Array.isArray(slideData.coveredGraphStateBackup.graphs)) {
        gCount = slideData.coveredGraphStateBackup.graphs.length;
      }
      const gCards = (slideData.primaryGraphCard ? 1 : 0) + (Array.isArray(slideData.extraGraphs) ? slideData.extraGraphs.length : 0);
      const pCards = (slideData.primaryProblemCard ? 1 : 0) + (Array.isArray(slideData.extraProblems) ? slideData.extraProblems.length : 0);
      if (slideData.audioSyncData && slideData.audioSyncData.durationMs > 0) parts.push('🎙️음성강의');
      if (pCards > 0) parts.push(`문제카드 ${pCards}개`);
      if (gCards > 0) parts.push(`보관그래프 #${gCards}`);
      if (gCount > 0) parts.push(`함수 ${gCount}개`);
      if (parts.length === 0) parts.push('판서 노트');
      return parts.join(' · ');
    }

    // ============================================================================
    // 🗄️ [IndexedDB 대용량 문서·음성 강의 로컬 캐시 엔진 (localStorage 5MB 한계 돌파)]
    // ============================================================================
    _openCloudCacheDB() {
      if (this._cloudCacheDbPromise) return this._cloudCacheDbPromise;
      if (typeof indexedDB === 'undefined') return Promise.resolve(null);
      this._cloudCacheDbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open('GraphlyCloudCacheDB', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('kv')) {
              db.createObjectStore('kv', { keyPath: 'key' });
            }
          };
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = () => {
            this._cloudCacheDbPromise = null;
            resolve(null);
          };
        } catch (e) {
          this._cloudCacheDbPromise = null;
          resolve(null);
        }
      });
      return this._cloudCacheDbPromise;
    }

    async _idbCacheGet(key) {
      if (!key) return null;
      try {
        const db = await this._openCloudCacheDB();
        if (!db) return null;
        return await new Promise((resolve) => {
          const tx = db.transaction('kv', 'readonly');
          const req = tx.objectStore('kv').get(key);
          req.onsuccess = () => resolve(req.result ? req.result.val : null);
          req.onerror = () => resolve(null);
        });
      } catch (e) {
        return null;
      }
    }

    async _idbCacheSet(key, val, expiresAt = 0) {
      if (!key) return false;
      try {
        const db = await this._openCloudCacheDB();
        if (!db) return false;
        const now = Date.now();
        return await new Promise((resolve) => {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({
            key,
            val,
            updatedAt: now,
            expiresAt: Number(expiresAt) || 0
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        return false;
      }
    }

    async _idbCacheDelete(key) {
      if (!key) return false;
      try {
        const db = await this._openCloudCacheDB();
        if (!db) return false;
        return await new Promise((resolve) => {
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        });
      } catch (e) {
        return false;
      }
    }

    async _idbCachePurgeExpired(nowMs = Date.now(), maxEntries = 80) {
      try {
        const db = await this._openCloudCacheDB();
        if (!db) return;
        await new Promise((resolve) => {
          const tx = db.transaction('kv', 'readwrite');
          const store = tx.objectStore('kv');
          const req = store.getAll();
          req.onsuccess = () => {
            const all = Array.isArray(req.result) ? req.result : [];
            const valid = [];
            for (let i = 0; i < all.length; i++) {
              const entry = all[i];
              if (!entry || !entry.key) continue;
              if (entry.expiresAt && entry.expiresAt > 0 && nowMs > entry.expiresAt) {
                try { store.delete(entry.key); } catch (_) { }
              } else {
                valid.push(entry);
              }
            }
            if (valid.length > maxEntries) {
              valid.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
              for (let i = maxEntries; i < valid.length; i++) {
                try { store.delete(valid[i].key); } catch (_) { }
              }
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch (e) { }
    }

    // 현재 로그인 계정의 클라우드 보관함 총 사용 용량(바이트) 계산 (요금제 용량 가드 연동용)
    getUserCloudLibraryTotalBytes() {
      if (!Array.isArray(this.myLibraryCache)) return 0;
      let total = 0;
      for (let i = 0; i < this.myLibraryCache.length; i++) {
        const it = this.myLibraryCache[i];
        if (!it || !this._isOwnedByCurrentCloudUser(it)) continue;
        const sz = Number(it.byteSize) || Number(it.rawByteSize) || 0;
        total += Math.max(0, sz);
      }
      return total;
    }

    // 요금제별 클라우드 용량 한도(Free 100MB / Pro 5GB / Premium 20GB) 및 단일 노트 용량 상한(80MB) 사전 점검
    checkCanUploadBytesToCloud(newBytes, replacingBytes = 0, contextLabel = '클라우드 저장') {
      const cfg = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
      const maxSingleBytes = (cfg && Number(cfg.maxSingleSharePayloadBytes) > 0)
        ? Number(cfg.maxSingleSharePayloadBytes)
        : (80 * 1024 * 1024);
      const quota = typeof this.getCurrentTierQuota === 'function'
        ? this.getCurrentTierQuota()
        : { tier: 'free', tierLabel: '무료', maxCloudBytes: 100 * 1024 * 1024, maxCloudLabel: '100 MB' };
      const usedBytes = Math.max(0, this.getUserCloudLibraryTotalBytes() - Math.max(0, Number(replacingBytes) || 0));
      const addBytes = Math.max(0, Number(newBytes) || 0);
      if (addBytes > maxSingleBytes) {
        const limStr = typeof this.formatBytesHuman === 'function' ? this.formatBytesHuman(maxSingleBytes) : '80 MB';
        this.showToast(`⚠️ ${contextLabel} 불가: 단일 수업 노트 권장 최대 용량(${limStr})을 초과했습니다. 쾌적한 열람을 위해 단원별로 나누어 저장해 주세요.`);
        return false;
      }
      const projectedBytes = usedBytes + addBytes;
      if (projectedBytes > quota.maxCloudBytes) {
        if (quota.tier === 'premium') {
          this.showToast(`⚠️ ${contextLabel} 불가: Premium 클라우드 용량 한도(${quota.maxCloudLabel})가 가득 찼습니다. 불필요한 파일을 정리해 주세요.`);
        } else {
          const usedStr = typeof this.formatBytesHuman === 'function' ? this.formatBytesHuman(usedBytes) : `${usedBytes} B`;
          const addStr = typeof this.formatBytesHuman === 'function' ? this.formatBytesHuman(addBytes) : `${addBytes} B`;
          this.showToast(`⚠️ ${contextLabel} 불가: ${quota.tierLabel} 플랜 용량 한도(${quota.maxCloudLabel})를 초과합니다. (현재 ${usedStr} + 추가 ${addStr})`);
          if (typeof this.openProPricingModal === 'function') {
            this.openProPricingModal(quota.tier === 'pro' ? 'premium' : 'pro');
          }
        }
        return false;
      }
      return true;
    }

    // Firestore 단일 문서 직접 쓰기 헬퍼 (PATCH 1회 원자적 Upsert 우선 사용 — 실패 시 예외 전파로 가짜 성공 토스트 원천 차단)
    async _firestoreRestWriteSingleDoc(collectionName, docId, jsonStr, options = null) {
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return docId;
      }
      const effOwnerUid = (options && options.ownerUid)
        ? String(options.ownerUid)
        : ((this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'anonymous');
      const fields = {
        jsonPayload: { stringValue: jsonStr },
        createdAt: { integerValue: String(Date.now()) },
        ownerUid: { stringValue: effOwnerUid }
      };
      if (options && options.expireAtMs && Number(options.expireAtMs) > 0) {
        fields.expireAt = { timestampValue: new Date(Number(options.expireAtMs)).toISOString() };
      }
      if (options && options.isPermanentShare === true) {
        fields.isPermanentShare = { booleanValue: true };
      }
      if (options && typeof options.premiumActiveUntilMs === 'number' && options.premiumActiveUntilMs > 0) {
        fields.premiumActiveUntil = { integerValue: String(Math.round(options.premiumActiveUntilMs)) };
      }
      if (options && options.shareTier) {
        fields.shareTier = { stringValue: String(options.shareTier) };
      }
      const body = { fields };
      const requireAuth = Boolean(this.cloudUser && this.cloudUser.uid) || collectionName !== 'shared_workspaces';
      const reqHeaders = await this._buildFirestoreRestHeaders(true, requireAuth);
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: reqHeaders,
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const postUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}?documentId=${encodeURIComponent(docId)}`;
        const postRes = await fetch(postUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(body)
        });
        if (!postRes.ok) {
          throw new Error(`FIRESTORE_WRITE_FAILED_${postRes.status || res.status || 'ERR'}`);
        }
      }
      return docId;
    }

    // 🌟 [브라우저 하드웨어 가속 Gzip 무손실 압축/복원 엔진 (클라우드·파일 용량 25~35% 다이어트, 하위 호환 100%)]
    async _compressJsonStringGzipBase64(jsonStr) {
      if (!jsonStr || typeof jsonStr !== 'string') return jsonStr;
      if (jsonStr.startsWith('GZ1:')) return jsonStr;
      if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return jsonStr;
      try {
        const inputBytes = new TextEncoder().encode(jsonStr);
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(inputBytes);
        writer.close();
        const compressedBuf = await new Response(cs.readable).arrayBuffer();
        const bytes = new Uint8Array(compressedBuf);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        const packed = 'GZ1:' + btoa(binary);
        return packed.length < jsonStr.length ? packed : jsonStr;
      } catch (e) {
        return jsonStr;
      }
    }

    async _decompressJsonStringGzipBase64(rawStr) {
      if (!rawStr || typeof rawStr !== 'string') return rawStr;
      const trimmed = rawStr.trim();
      if (!trimmed.startsWith('GZ1:')) return rawStr;
      if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') {
        throw new Error('GZIP_DECOMPRESSION_UNSUPPORTED');
      }
      const b64 = trimmed.slice(4);
      const binary = atob(b64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const decompressedBuf = await new Response(ds.readable).arrayBuffer();
      return new TextDecoder('utf-8').decode(decompressedBuf);
    }

    _measureUtf8Bytes(str) {
      if (!str || typeof str !== 'string') return 0;
      if (str.startsWith('GZ1:')) return str.length;
      try {
        if (typeof TextEncoder !== 'undefined') {
          if (!this._sharedUtf8Encoder) this._sharedUtf8Encoder = new TextEncoder();
          return this._sharedUtf8Encoder.encode(str).byteLength;
        }
      } catch (_) { }
      let bytes = 0;
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) bytes += 1;
        else if (c < 0x800) bytes += 2;
        else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
          const next = str.charCodeAt(i + 1);
          if (next >= 0xDC00 && next <= 0xDFFF) {
            bytes += 4;
            i++;
          } else {
            bytes += 3;
          }
        } else {
          bytes += 3;
        }
      }
      return bytes;
    }

    _measureJsonEscapedUtf8Bytes(str) {
      if (!str || typeof str !== 'string') return 0;
      if (str.startsWith('GZ1:')) return str.length;
      let bytes = 0;
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c === 0x22 || c === 0x5C || c === 0x08 || c === 0x0C || c === 0x0A || c === 0x0D || c === 0x09) {
          bytes += 2;
        } else if (c < 0x20) {
          bytes += 6;
        } else if (c < 0x80) {
          bytes += 1;
        } else if (c < 0x800) {
          bytes += 2;
        } else if (c >= 0xD800 && c <= 0xDBFF) {
          const next = (i + 1 < str.length) ? str.charCodeAt(i + 1) : 0;
          if (next >= 0xDC00 && next <= 0xDFFF) {
            bytes += 4;
            i++;
          } else {
            bytes += 6;
          }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
          bytes += 6;
        } else {
          bytes += 3;
        }
      }
      return bytes;
    }

    // 🌟 [Firestore 1MiB 하드 리밋 방어 & UTF-16 서로게이트 쌍(이모지/수학기호) 경계 보호 청크 분할기]
    _splitStringIntoSafeFirestoreChunks(str, maxSafeBytes = 700000) {
      if (!str || typeof str !== 'string') return [];
      const safeLimit = Math.max(1024, Number(maxSafeBytes) || 700000);
      // GZ1: Base64 문자열은 순수 1바이트 ASCII([A-Za-z0-9+/=:])이므로 고속 고정폭 슬라이스
      if (str.startsWith('GZ1:')) {
        const fastChunks = [];
        for (let i = 0; i < str.length; i += safeLimit) {
          fastChunks.push(str.slice(i, i + safeLimit));
        }
        return fastChunks;
      }
      const chunks = [];
      let chunkStart = 0;
      let curBytes = 0;
      let i = 0;
      const len = str.length;
      while (i < len) {
        const c = str.charCodeAt(i);
        let stepUnits = 1;
        let charCost = 1;
        if (c === 0x22 || c === 0x5C || c === 0x08 || c === 0x0C || c === 0x0A || c === 0x0D || c === 0x09) {
          charCost = 2;
        } else if (c < 0x20) {
          charCost = 6;
        } else if (c < 0x80) {
          charCost = 1;
        } else if (c < 0x800) {
          charCost = 2;
        } else if (c >= 0xD800 && c <= 0xDBFF) {
          const next = (i + 1 < len) ? str.charCodeAt(i + 1) : 0;
          if (next >= 0xDC00 && next <= 0xDFFF) {
            stepUnits = 2;
            charCost = 4;
          } else {
            charCost = 6;
          }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
          charCost = 6;
        } else {
          charCost = 3;
        }
        if (curBytes + charCost > safeLimit && i > chunkStart) {
          chunks.push(str.slice(chunkStart, i));
          chunkStart = i;
          curBytes = 0;
        }
        curBytes += charCost;
        i += stepUnits;
      }
      if (chunkStart < len) {
        chunks.push(str.slice(chunkStart, len));
      }
      return chunks;
    }

    async _fetchFirestoreDocWithRetry(url, fetchOpts = undefined, maxRetries = 2) {
      const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
      let lastRes = null;
      let lastErr = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const delayMs = attempt === 1 ? 220 : 550;
          await new Promise(r => setTimeout(r, delayMs));
        }
        try {
          const r = fetchOpts ? await fetch(url, fetchOpts) : await fetch(url);
          if (r && r.ok) return r;
          lastRes = r;
          if (r && !retryableStatuses.has(r.status)) {
            return r;
          }
        } catch (err) {
          lastErr = err;
        }
      }
      if (lastRes) return lastRes;
      throw (lastErr || new Error('FIRESTORE_FETCH_FAILED'));
    }

    // 🚀 [무필기 PDF 통페이지 이중 저장 원천 제거 & 0.00초 즉시 스냅샷 바인딩 엔진]
    _isPureUnannotatedPdfPageSlide(slide, filterOpts = null) {
      if (!slide || !slide.pdfPageBoardData || typeof slide.pdfPageBoardData.dataUrl !== 'string' || !slide.pdfPageBoardData.dataUrl.startsWith('data:image/')) {
        return false;
      }
      if (filterOpts && filterOpts.includeProblem === false) {
        return false;
      }
      if (slide.isGraphCovered === false) {
        return false;
      }
      if (slide.primaryProblemCard || (Array.isArray(slide.extraProblems) && slide.extraProblems.length > 0)) {
        return false;
      }
      const incGraph = !filterOpts || filterOpts.includeGraph !== false;
      if (incGraph && (slide.primaryGraphCard || (Array.isArray(slide.extraGraphs) && slide.extraGraphs.length > 0))) {
        return false;
      }
      const incInk = !filterOpts || filterOpts.includeInk !== false;
      if (slide.historyJson) {
        try {
          const hObj = typeof slide.historyJson === 'string' ? JSON.parse(slide.historyJson) : slide.historyJson;
          if (hObj) {
            if (incInk && Array.isArray(hObj.inkStrokes) && hObj.inkStrokes.length > 0) {
              return false;
            }
            if (Array.isArray(hObj.boardStickers) && hObj.boardStickers.length > 0) {
              return false;
            }
          }
        } catch (e) {
          return false;
        }
      }
      return true;
    }

    _applyFastPdfBoardViewerSnapshot(slide) {
      if (!slide || !slide.pdfPageBoardData || !slide.pdfPageBoardData.dataUrl) return false;
      const pbd = slide.pdfPageBoardData;
      const aspect = (typeof pbd.aspect === 'number' && pbd.aspect > 0) ? pbd.aspect : 1.414;
      const snapW = Math.max(600, Math.round(pbd.pixelW || 1920));
      const snapH = Math.max(600, Math.round(pbd.pixelH || (snapW * aspect)));
      slide.viewerSnapshotDataUrl = pbd.dataUrl;
      slide.viewerSnapshotWidth = snapW;
      slide.viewerSnapshotHeight = snapH;
      slide.viewerGraphHotspots = [];
      slide.viewerStickerHotspots = [];
      slide._viewerHiResRendered = true;
      return true;
    }

    _stringifyWithDeduplicatedSnapshots(obj) {
      if (!obj || typeof obj !== 'object') return JSON.stringify(obj);
      const slides = Array.isArray(obj.playlistSlides) ? obj.playlistSlides : (obj.slideData ? [obj.slideData] : []);
      const restoredPairs = [];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (s && s.pdfPageBoardData && s.pdfPageBoardData.dataUrl && s.viewerSnapshotDataUrl === s.pdfPageBoardData.dataUrl) {
          restoredPairs.push({ slide: s, url: s.viewerSnapshotDataUrl });
          s.viewerSnapshotDataUrl = '__SAME_AS_PDF_BOARD__';
        }
      }
      try {
        return JSON.stringify(obj);
      } finally {
        for (let i = 0; i < restoredPairs.length; i++) {
          restoredPairs[i].slide.viewerSnapshotDataUrl = restoredPairs[i].url;
        }
      }
    }

    _restoreDeduplicatedSlideSnapshots(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      const slides = Array.isArray(obj.playlistSlides)
        ? obj.playlistSlides
        : (obj.slideData ? [obj.slideData] : (obj.pdfPageBoardData ? [obj] : []));
      const effFilter = obj.exportFilter || null;
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s || !s.pdfPageBoardData || !s.pdfPageBoardData.dataUrl) continue;
        if (s.viewerSnapshotDataUrl === '__SAME_AS_PDF_BOARD__' || (!s.viewerSnapshotDataUrl && this._isPureUnannotatedPdfPageSlide(s, effFilter))) {
          this._applyFastPdfBoardViewerSnapshot(s);
        }
      }
      return obj;
    }

    async _populateSlideViewerSnapshotsForExport(slides, effFilter, forceRebuildAnnotated = false) {
      if (!Array.isArray(slides) || slides.length === 0) return slides;
      const indicesNeedingRender = [];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        if (!s) continue;
        if (this._isPureUnannotatedPdfPageSlide(s, effFilter)) {
          this._applyFastPdfBoardViewerSnapshot(s);
        } else if (forceRebuildAnnotated || !s.viewerSnapshotDataUrl || s.viewerSnapshotDataUrl === '__SAME_AS_PDF_BOARD__') {
          indicesNeedingRender.push(i);
        }
      }
      if (indicesNeedingRender.length === 0) {
        return slides;
      }

      const isOuterLoop = !this._isCapturingExportSnapshots;
      if (isOuterLoop) {
        this._isCapturingExportSnapshots = true;
        this._exportSnapshotLoopRawSlides = JSON.parse(JSON.stringify(slides));
        this._exportSnapshotLoopBackupCurrent = this.serializeFullSlideState('backup');
      }
      try {
        for (let k = 0; k < indicesNeedingRender.length; k++) {
          const i = indicesNeedingRender[k];
          this.deserializeFullSlideState(slides[i]);
          await this._waitForSlideImagesReady();
          const snap = this.captureCurrentSlideViewerSnapshot(effFilter, true);
          slides[i].viewerSnapshotDataUrl = snap.dataUrl;
          slides[i].viewerSnapshotWidth = snap.width;
          slides[i].viewerSnapshotHeight = snap.height;
          slides[i].viewerGraphHotspots = snap.hotspots;
          slides[i].viewerStickerHotspots = snap.stickerHotspots;
          slides[i].viewerSmartBounds = snap.smartBounds;
          slides[i]._viewerHiResRendered = true;
        }
      } finally {
        if (isOuterLoop) {
          this._isCapturingExportSnapshots = false;
          const backupToRestore = this._exportSnapshotLoopBackupCurrent;
          this._exportSnapshotLoopRawSlides = null;
          this._exportSnapshotLoopBackupCurrent = null;
          if (backupToRestore) {
            this.deserializeFullSlideState(backupToRestore);
          }
        }
      }
      return slides;
    }

    // Firestore REST API 헬퍼 (대용량 30~50문항 풀세트도 1MB 제한 없이 자동 Gzip 무손실 압축 + 6개 단위 안전 배치 분할 업로드 지원!)
    async _firestoreRestWrite(collectionName, docId, payloadObj, options = null) {
      const fullStr = this._stringifyWithDeduplicatedSnapshots(payloadObj);
      const netStr = await this._compressJsonStringGzipBase64(fullStr);
      const rawByteSize = this._measureUtf8Bytes(fullStr);
      const byteSize = this._measureUtf8Bytes(netStr);
      if (payloadObj && typeof payloadObj === 'object') {
        payloadObj.byteSize = byteSize;
        payloadObj.rawByteSize = rawByteSize;
      }

      const skipLocalFullCache = Boolean(options && options.skipLocalFullCache);
      const expireAtMs = (options && options.expireAtMs !== undefined)
        ? Number(options.expireAtMs) || 0
        : ((payloadObj && payloadObj.expiresAt) || 0);
      const isPermanentShare = Boolean((options && options.isPermanentShare) || (payloadObj && payloadObj.isPermanentShare));
      const premiumActiveUntilMs = Number((options && options.premiumActiveUntilMs) || (payloadObj && payloadObj.premiumActiveUntil) || 0);
      const shareTier = String((options && options.shareTier) || (payloadObj && payloadObj.shareTier) || '').trim();
      const baseUid = (options && options.baseOwnerUid)
        ? String(options.baseOwnerUid)
        : ((this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'anonymous');

      const CHUNK_LIMIT = 700000; // UTF-8 + JSON 이스케이프 후 ~700KB 이내 안전 분할 (Firestore 1MiB 하드 리밋 방어)
      const isUserLibrary = (collectionName === 'user_library');
      const netEscapedBytes = this._measureJsonEscapedUtf8Bytes(netStr);

      // user_library는 로그인/목록 조회 시 본문 다운로드 트래픽을 0으로 만들기 위해 항상 경량 매니페스트 + 전용 청크(user_library 내 chunk_UID)로 분리!
      if (!isUserLibrary && netEscapedBytes <= CHUNK_LIMIT) {
        const singleRes = await this._firestoreRestWriteSingleDoc(collectionName, docId, netStr, {
          ownerUid: baseUid,
          expireAtMs,
          isPermanentShare,
          premiumActiveUntilMs,
          shareTier
        });
        if (!skipLocalFullCache) {
          await this._idbCacheSet('graphly_full_doc_' + docId, netStr, expireAtMs).catch(() => { });
          try { localStorage.removeItem('graphly_full_doc_' + docId); } catch (e) { }
        }
        return singleRes;
      }

      const chunks = this._splitStringIntoSafeFirestoreChunks(netStr, CHUNK_LIMIT);
      const prefix = `${docId}_part_`;
      const chunkCollection = isUserLibrary ? 'user_library' : 'shared_workspaces';
      const chunkOwnerUid = isUserLibrary ? `chunk_${baseUid}` : `chunk_share_${baseUid}`;

      const BATCH_SIZE = 6;
      for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
        const batchSlice = chunks.slice(b, b + BATCH_SIZE);
        await Promise.all(batchSlice.map((cStr, localIdx) => {
          const idx = b + localIdx;
          return this._firestoreRestWriteSingleDoc(
            chunkCollection,
            `${prefix}${idx}`,
            JSON.stringify({ _isChunkPart: true, parentId: docId, partIndex: idx, data: cStr }),
            { ownerUid: chunkOwnerUid, expireAtMs: (isUserLibrary || isPermanentShare) ? 0 : expireAtMs }
          );
        }));
      }

      // 목록 조회용 경량 매니페스트 문서 생성 (보관함 목록 로딩 0.05초 보장 & 영구 보관함 청크 격리!)
      const manifestObj = {
        ...payloadObj,
        slideData: null,
        playlistSlides: null,
        byteSize,
        rawByteSize,
        _isChunked: true,
        _chunkCollection: chunkCollection,
        _chunkDocPrefix: prefix,
        _chunkCount: chunks.length
      };
      if (payloadObj && typeof payloadObj === 'object') {
        payloadObj._isChunked = true;
        payloadObj._chunkCollection = chunkCollection;
        payloadObj._chunkDocPrefix = prefix;
        payloadObj._chunkCount = chunks.length;
      }
      const writeRes = await this._firestoreRestWriteSingleDoc(collectionName, docId, JSON.stringify(manifestObj), {
        ownerUid: baseUid,
        expireAtMs,
        isPermanentShare,
        premiumActiveUntilMs,
        shareTier
      });
      if (!skipLocalFullCache) {
        await this._idbCacheSet('graphly_full_doc_' + docId, netStr, expireAtMs).catch(() => { });
        try { localStorage.removeItem('graphly_full_doc_' + docId); } catch (e) { }
      }
      return writeRes;
    }

    async _firestoreRestReadDoc(collectionName, docId, skipLocalCache = false, allowLockedForOwner = false) {
      if (!skipLocalCache) {
        try {
          const idbVal = await this._idbCacheGet('graphly_full_doc_' + docId);
          const localFull = idbVal || localStorage.getItem('graphly_full_doc_' + docId);
          if (localFull) {
            const uncompLocal = typeof localFull === 'string'
              ? await this._decompressJsonStringGzipBase64(localFull)
              : JSON.stringify(localFull);
            const parsedLocal = typeof uncompLocal === 'string' ? JSON.parse(uncompLocal) : uncompLocal;
            if (parsedLocal) return this._restoreDeduplicatedSlideSnapshots(parsedLocal);
          }
        } catch (e) { }
      }
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return null;
      }

      const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
      const isPublicShareRead = (collectionName === 'shared_workspaces' || collectionName === 'cloud_share_vault');
      const reqHeaders = isPublicShareRead ? {} : await this._buildFirestoreRestHeaders(false, true);
      const res = await this._fetchFirestoreDocWithRetry(url, Object.keys(reqHeaders).length ? { headers: reqHeaders } : undefined);
      if (!res || !res.ok) return null;
      const data = await res.json();
      if (data && data.fields && data.fields.jsonPayload && data.fields.jsonPayload.stringValue) {
        const rawCompressed = data.fields.jsonPayload.stringValue;
        const rawVal = await this._decompressJsonStringGzipBase64(rawCompressed);
        const parsed = JSON.parse(rawVal);
        const topIsPerm = Boolean(data.fields.isPermanentShare && data.fields.isPermanentShare.booleanValue);
        const hasTopPremUntil = Boolean(data.fields.premiumActiveUntil && data.fields.premiumActiveUntil.integerValue !== undefined);
        const topPremUntil = hasTopPremUntil
          ? (Number(data.fields.premiumActiveUntil.integerValue) || 0)
          : 0;
        if (parsed && typeof parsed === 'object') {
          if (topIsPerm) parsed._topIsPermanentShare = true;
          if (hasTopPremUntil) {
            parsed._hasTopPremiumActiveUntil = true;
            parsed._topPremiumActiveUntil = topPremUntil;
          }
        }

        // 외부 공유 링크 조회 시 만료(3일/7일)되었거나 Premium 유예기간(7일) 경과/환불 잠금 상태면 불필요한 청크 다운로드를 생략하고 매니페스트만 즉시 반환!
        if (collectionName === 'shared_workspaces' && !allowLockedForOwner && parsed && typeof parsed === 'object') {
          const isPermDoc = Boolean(parsed.isPermanentShare || topIsPerm || parsed.expiresAt === 0);
          if (isPermDoc) {
            const effPremUntil = hasTopPremUntil ? topPremUntil : (Number(parsed.premiumActiveUntil) || 0);
            const cfg = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
            const graceMs = ((cfg && Number(cfg.premiumShareGraceDays)) || 7) * 86400000;
            if ((hasTopPremUntil && effPremUntil <= 0) || (effPremUntil > 0 && Date.now() > (effPremUntil + graceMs))) {
              return parsed;
            }
          } else {
            const expDays = Number(parsed.shareExpiryDays) || 7;
            const expMs = Number(parsed.expiresAt) || ((parsed.createdAt || 0) + expDays * 86400000);
            if (parsed.createdAt && Date.now() > expMs) {
              return parsed;
            }
          }
        }

        if (parsed && !parsed._isChunked && !parsed._isVaultPointer && !parsed._isVaultLayered && !skipLocalCache && docId) {
          await this._idbCacheSet('graphly_full_doc_' + docId, rawCompressed, parsed.expiresAt || 0).catch(() => { });
        }
        const resolved = (collectionName === 'user_library' || collectionName === 'shared_workspaces')
          ? await this._resolveChunkedItem(parsed, collectionName, skipLocalCache)
          : parsed;
        if (resolved && typeof resolved === 'object') {
          if (topIsPerm) resolved._topIsPermanentShare = true;
          if (hasTopPremUntil) {
            resolved._hasTopPremiumActiveUntil = true;
            resolved._topPremiumActiveUntil = topPremUntil;
          }
        }
        return this._restoreDeduplicatedSlideSnapshots(resolved);
      }
      return null;
    }

    // 분할 저장된 대용량 수업 세트, 6-채널 볼트(cloud_share_vault) 원본, 또는 주소표(Vault Pointer)를 병렬 재조립하여 반환
    async _resolveChunkedItem(item, sourceCollection = '', skipLocalCache = false) {
      if (!item) return item;

      // 1) 외부 공유 주소표(Vault Pointer): 주소표에 허가된 난수 볼트 키(vaultRefs)만 병렬 조회하여 즉석 조립
      if (item._isVaultPointer && item.vaultRefs && typeof this._resolveVaultPointerSharePackage === 'function') {
        return await this._resolveVaultPointerSharePackage(item, skipLocalCache);
      }

      const hydrateLibraryAudioIfNeeded = async (targetObj) => {
        if (!targetObj || sourceCollection === 'shared_workspaces') return targetObj;
        if (typeof this._ensureCloudShareAudioLoaded !== 'function') return targetObj;
        const hasLazyStub = Boolean(
          (targetObj._hasLazyAudio && (targetObj._audioChunkCount > 0 || targetObj._vaultAudioKey)) ||
          (Array.isArray(targetObj.playlistSlides) && targetObj.playlistSlides.some(s => s && s.audioSyncData && s.audioSyncData._isLazyAudioStub))
        );
        if (!hasLazyStub) return targetObj;
        const shareRefId = targetObj.linkedShareId || targetObj.id || '';
        if (!targetObj._audioChunkPrefix && !targetObj._vaultAudioKey && shareRefId) {
          targetObj._audioChunkPrefix = `${shareRefId}_audio_`;
        }
        await this._ensureCloudShareAudioLoaded(targetObj);
        return targetObj;
      };

      if ((Array.isArray(item.playlistSlides) && item.playlistSlides.length > 0) || item.slideData) {
        await hydrateLibraryAudioIfNeeded(item);
        return this._restoreDeduplicatedSlideSnapshots(item);
      }
      if (item.id && !skipLocalCache) {
        try {
          const idbVal = await this._idbCacheGet('graphly_full_doc_' + item.id);
          const localFull = idbVal || localStorage.getItem('graphly_full_doc_' + item.id);
          if (localFull) {
            const uncompLocal = typeof localFull === 'string'
              ? await this._decompressJsonStringGzipBase64(localFull)
              : JSON.stringify(localFull);
            const parsedLocal = typeof uncompLocal === 'string' ? JSON.parse(uncompLocal) : uncompLocal;
            if (parsedLocal && ((Array.isArray(parsedLocal.playlistSlides) && parsedLocal.playlistSlides.length > 0) || parsedLocal.slideData)) {
              const reqStamp = Number(item.vaultUpdatedAt || item.updatedAt || 0);
              const locStamp = Number(parsedLocal.vaultUpdatedAt || parsedLocal.updatedAt || 0);
              const isLocalStale = (reqStamp > 0 && locStamp > 0 && reqStamp > locStamp + 1000) ||
                Boolean(item._isVaultLayered && item.vaultUpdatedAt && !parsedLocal.vaultUpdatedAt);
              if (!isLocalStale) {
                const mergedLocal = {
                  ...parsedLocal,
                  ...item,
                  title: item.title || parsedLocal.title,
                  folder: item.folder !== undefined ? item.folder : parsedLocal.folder,
                  playlistSlides: parsedLocal.playlistSlides,
                  slideData: parsedLocal.slideData || null
                };
                await hydrateLibraryAudioIfNeeded(mergedLocal);
                return this._restoreDeduplicatedSlideSnapshots(mergedLocal);
              }
            }
          }
        } catch (e) { }
      }

      // 2) 클라우드 보관함 6-채널 원본 볼트(cloud_share_vault) 저장 항목: 전체 채널을 무손실 복원
      if (sourceCollection !== 'shared_workspaces' && item._isVaultLayered && item.vaultKeys && typeof this._resolveVaultLayeredLibraryItem === 'function') {
        const vaultResolved = await this._resolveVaultLayeredLibraryItem(item, true);
        if (vaultResolved && Array.isArray(vaultResolved.playlistSlides) && vaultResolved.playlistSlides.length > 0) {
          return this._restoreDeduplicatedSlideSnapshots(vaultResolved);
        }
      }
      if (sourceCollection !== 'shared_workspaces' && item.linkedShareId) {
        try {
          const sharedPkg = await this._firestoreRestReadDoc('shared_workspaces', String(item.linkedShareId), false, true);
          if (sharedPkg && ((Array.isArray(sharedPkg.playlistSlides) && sharedPkg.playlistSlides.length > 0) || sharedPkg.slideData)) {
            await this._ensureCloudShareAudioLoaded(sharedPkg);
            const mergedSharedOrigin = {
              ...sharedPkg,
              ...item,
              id: item.id,
              title: item.title || sharedPkg.title || '공유 수업 노트',
              folder: item.folder !== undefined ? item.folder : (sharedPkg.folder || ''),
              playlistSlides: sharedPkg.playlistSlides,
              slideData: sharedPkg.slideData || null,
              _hasLazyAudio: Boolean(sharedPkg._hasLazyAudio),
              _lazyAudioLoaded: Boolean(sharedPkg._lazyAudioLoaded)
            };
            if (item.id && !mergedSharedOrigin._hasLazyAudio) {
              const compOrigin = await this._compressJsonStringGzipBase64(this._stringifyWithDeduplicatedSnapshots(mergedSharedOrigin));
              await this._idbCacheSet('graphly_full_doc_' + item.id, compOrigin, 0).catch(() => { });
            }
            return this._restoreDeduplicatedSlideSnapshots(mergedSharedOrigin);
          }
        } catch (e) { }
      }
      if (!item._isChunked || !item._chunkCount || !item._chunkDocPrefix) {
        if (sourceCollection !== 'shared_workspaces' && item.id && typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
          try {
            const authHeaders = await this._buildFirestoreRestHeaders(false, true);
            const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/user_library/${encodeURIComponent(item.id)}`;
            const r = await this._fetchFirestoreDocWithRetry(url, Object.keys(authHeaders).length ? { headers: authHeaders } : undefined);
            if (r && r.ok) {
              const d = await r.json();
              if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
                const rawVal = await this._decompressJsonStringGzipBase64(d.fields.jsonPayload.stringValue);
                const parsed = JSON.parse(rawVal);
                if (parsed && parsed._isVaultLayered && parsed.vaultKeys && typeof this._resolveVaultLayeredLibraryItem === 'function') {
                  const mergedVaultManifest = { ...item, ...parsed };
                  const vaultResolved = await this._resolveVaultLayeredLibraryItem(mergedVaultManifest, true);
                  if (vaultResolved && Array.isArray(vaultResolved.playlistSlides) && vaultResolved.playlistSlides.length > 0) {
                    return this._restoreDeduplicatedSlideSnapshots(vaultResolved);
                  }
                } else if (parsed && parsed._isChunked && parsed._chunkCount && parsed._chunkDocPrefix) {
                  item = { ...item, ...parsed };
                } else if (parsed && ((Array.isArray(parsed.playlistSlides) && parsed.playlistSlides.length > 0) || parsed.slideData)) {
                  if (item.id) {
                    await this._idbCacheSet('graphly_full_doc_' + item.id, d.fields.jsonPayload.stringValue, parsed.expiresAt || 0).catch(() => { });
                  }
                  const mergedSingle = { ...item, ...parsed };
                  await hydrateLibraryAudioIfNeeded(mergedSingle);
                  return this._restoreDeduplicatedSlideSnapshots(mergedSingle);
                } else if (parsed && parsed.linkedShareId && sourceCollection !== 'shared_workspaces') {
                  const sharedFromDoc = await this._firestoreRestReadDoc('shared_workspaces', String(parsed.linkedShareId), false, true);
                  if (sharedFromDoc && ((Array.isArray(sharedFromDoc.playlistSlides) && sharedFromDoc.playlistSlides.length > 0) || sharedFromDoc.slideData)) {
                    await this._ensureCloudShareAudioLoaded(sharedFromDoc);
                    return this._restoreDeduplicatedSlideSnapshots({
                      ...sharedFromDoc,
                      ...item,
                      ...parsed,
                      playlistSlides: sharedFromDoc.playlistSlides,
                      slideData: sharedFromDoc.slideData || null,
                      _hasLazyAudio: Boolean(sharedFromDoc._hasLazyAudio)
                    });
                  }
                }
              }
            }
          } catch (e) { }
        }
        if (!item._isChunked || !item._chunkCount || !item._chunkDocPrefix) return this._restoreDeduplicatedSlideSnapshots(item);
      }
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return this._restoreDeduplicatedSlideSnapshots(item);
      }
      try {
        const preferredCol = item._chunkCollection || 'shared_workspaces';
        const fallbackCol = preferredCol === 'user_library' ? 'shared_workspaces' : 'user_library';
        const authHeaders = (preferredCol === 'user_library' || this.cloudUser)
          ? await this._buildFirestoreRestHeaders(false, preferredCol === 'user_library')
          : {};
        const expectedCount = Number(item._chunkCount) || 0;
        const indices = Array.from({ length: expectedCount }, (_, i) => i);
        const parts = await Promise.all(indices.map(async (idx) => {
          const chunkDocId = `${item._chunkDocPrefix}${idx}`;
          const primaryUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${preferredCol}/${encodeURIComponent(chunkDocId)}`;
          const primaryOpts = (preferredCol === 'user_library' && Object.keys(authHeaders).length) ? { headers: authHeaders } : undefined;
          let r = await this._fetchFirestoreDocWithRetry(primaryUrl, primaryOpts);
          if ((!r || !r.ok) && r && (r.status === 404 || r.status === 403)) {
            const fallbackUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${fallbackCol}/${encodeURIComponent(chunkDocId)}`;
            const fallbackOpts = (fallbackCol === 'user_library' && Object.keys(authHeaders).length) ? { headers: authHeaders } : undefined;
            r = await this._fetchFirestoreDocWithRetry(fallbackUrl, fallbackOpts);
          }
          if (!r || !r.ok) return null;
          const d = await r.json();
          if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
            const pObj = JSON.parse(d.fields.jsonPayload.stringValue);
            if (typeof pObj.data === 'string' && pObj.data.length > 0) {
              return pObj.data;
            }
          }
          return null;
        }));
        // 🚨 [데이터 무결성 · 독성 캐시 원천 차단]: 모든 청크가 1개도 빠짐없이 수신된 경우에만 조립 및 IndexedDB 캐싱!
        const allChunksOk = expectedCount > 0 && parts.length === expectedCount && parts.every(p => typeof p === 'string' && p.length > 0);
        if (allChunksOk) {
          const joined = parts.join('');
          const decompressedJoined = await this._decompressJsonStringGzipBase64(joined);
          const fullItem = JSON.parse(decompressedJoined);
          const mergedFull = {
            ...fullItem,
            ...item,
            playlistSlides: fullItem.playlistSlides || item.playlistSlides || null,
            slideData: fullItem.slideData || item.slideData || null
          };
          if (item.id) {
            await this._idbCacheSet('graphly_full_doc_' + item.id, joined, mergedFull.expiresAt || 0).catch(() => { });
          }
          await hydrateLibraryAudioIfNeeded(mergedFull);
          return this._restoreDeduplicatedSlideSnapshots(mergedFull);
        }
      } catch (e) { }
      return item;
    }

    // ============================================================================
    // 🗄️ [6-채널 원본 볼트(cloud_share_vault) 분해 · 선택 재조립 · 주소표(Vault Pointer) 코어 엔진]
    // - 클라우드 파일 저장 시 6개 채널(skeleton / prob / graph / ink / audio / snap)로 원본 1벌만 저장
    // - 공유 링크 추출 시 사본 복제(0바이트) 없이 허가된 채널의 26자 보안 난수 키만 담은 주소표 발급
    // - 덮어쓰기 저장 시 동일한 vaultKeys 유지 + vaultUpdatedAt 갱신으로 인쇄된 QR 코드에 수정사항 즉시 반영
    // ============================================================================
    _generateCloudVaultKeys() {
      return {
        skeletonKey: 'vlt_sk_' + this._generateSecureRandomAlphaNum(26),
        probKey: 'vlt_pr_' + this._generateSecureRandomAlphaNum(26),
        graphKey: 'vlt_gr_' + this._generateSecureRandomAlphaNum(26),
        inkKey: 'vlt_ik_' + this._generateSecureRandomAlphaNum(26),
        audioKey: 'vlt_au_' + this._generateSecureRandomAlphaNum(26),
        snapKey: 'vlt_sn_' + this._generateSecureRandomAlphaNum(26)
      };
    }

    _getExportFilterSignatureKey(filterOpts = null) {
      const f = filterOpts || {};
      const p = f.includeProblem !== false ? '1' : '0';
      const g = f.includeGraph !== false ? '1' : '0';
      const i = f.includeInk !== false ? '1' : '0';
      const a = f.includeAudio !== false ? '1' : '0';
      return `${p}${g}${i}${a}`;
    }

    _decomposeSlidesIntoVaultLayers(rawSlides, vaultUpdatedAt = Date.now()) {
      const slides = Array.isArray(rawSlides) ? JSON.parse(JSON.stringify(rawSlides)) : [];
      const KNOWN_ROOT_KEYS = new Set([
        'version', 'slideTitle', 'timestamp', 'historyJson',
        'isGraphCovered', 'coveredGraphStateBackup', 'savedLayer2BoardPan',
        'suspendedPdfBoardState', 'retainedPdfAudioProbCard', 'graphSessionArchived',
        'graphCaseCounter', 'primaryProblemCard', 'extraProblems',
        'primaryGraphCard', 'extraGraphs', 'pdfPageBoardData', 'audioSyncData',
        'viewerSnapshotDataUrl', 'viewerSnapshotWidth', 'viewerSnapshotHeight',
        'viewerGraphHotspots', 'viewerStickerHotspots', 'viewerSmartBounds', '_viewerHiResRendered'
      ]);
      const GRAPH_HISTORY_KEYS = [
        'graphs', 'activeGraphIdx', 'usePiecewise', 'piecewiseBoundaries',
        'piecewiseFuncMap', 'piecewiseInclusions', 'isPiecewisePeriodic',
        'periodicStepY', 'isPiecewiseLocked', 'showInverseGuide',
        'dropLines', 'textLabels'
      ];

      const splitGraphSnapshotInk = (snapVal) => {
        if (!snapVal) return { cleanSnap: snapVal, strokes: null };
        if (typeof snapVal === 'object') {
          const cloned = JSON.parse(JSON.stringify(snapVal));
          const hasProp = Object.prototype.hasOwnProperty.call(cloned, 'graphInkStrokes');
          const strokes = Array.isArray(cloned.graphInkStrokes) ? cloned.graphInkStrokes : (hasProp ? [] : null);
          if (hasProp) cloned.graphInkStrokes = [];
          return { cleanSnap: cloned, strokes };
        }
        if (typeof snapVal === 'string') {
          try {
            const parsed = JSON.parse(snapVal);
            if (parsed && typeof parsed === 'object') {
              const hasProp = Object.prototype.hasOwnProperty.call(parsed, 'graphInkStrokes');
              const strokes = Array.isArray(parsed.graphInkStrokes) ? parsed.graphInkStrokes : (hasProp ? [] : null);
              if (hasProp) parsed.graphInkStrokes = [];
              return { cleanSnap: JSON.stringify(parsed), strokes };
            }
          } catch (e) { }
        }
        return { cleanSnap: snapVal, strokes: null };
      };

      const skeletonSlides = [];
      const probSlides = [];
      const graphSlides = [];
      const inkSlides = [];
      const snapSlides = [];
      const audioMap = {};

      let hasProbContent = false;
      let hasGraphContent = false;
      let hasInkContent = false;
      let hasAudioContent = false;
      let hasSnapContent = false;

      for (let idx = 0; idx < slides.length; idx++) {
        const s = slides[idx] || {};
        const extraRootFields = {};
        Object.keys(s).forEach((k) => {
          if (!KNOWN_ROOT_KEYS.has(k)) {
            extraRootFields[k] = s[k];
          }
        });

        const hasHistoryJson = Boolean(s.historyJson);
        const historyWasString = (typeof s.historyJson === 'string');
        let hObj = null;
        if (hasHistoryJson) {
          try {
            hObj = historyWasString ? JSON.parse(s.historyJson) : JSON.parse(JSON.stringify(s.historyJson));
          } catch (e) {
            hObj = null;
          }
        }

        const historyBase = {};
        const historyGraph = {};
        let boardInkStrokes = [];
        const probStickersIndexed = [];
        const graphStickersIndexed = [];
        const inkStickersIndexed = [];
        let hadBoardStickersProp = false;

        if (hObj && typeof hObj === 'object') {
          hadBoardStickersProp = Object.prototype.hasOwnProperty.call(hObj, 'boardStickers');
          Object.keys(hObj).forEach((hk) => {
            if (hk === 'inkStrokes') {
              boardInkStrokes = Array.isArray(hObj.inkStrokes) ? hObj.inkStrokes : [];
            } else if (hk === 'boardStickers') {
              if (Array.isArray(hObj.boardStickers)) {
                hObj.boardStickers.forEach((stk, stkIdx) => {
                  if (!stk) return;
                  if (stk.onPdfBoard) {
                    probStickersIndexed.push({ order: stkIdx, stk });
                  } else if (stk.target === 'graph') {
                    graphStickersIndexed.push({ order: stkIdx, stk });
                  } else {
                    inkStickersIndexed.push({ order: stkIdx, stk });
                  }
                });
              }
            } else if (GRAPH_HISTORY_KEYS.includes(hk)) {
              historyGraph[hk] = hObj[hk];
            } else {
              historyBase[hk] = hObj[hk];
            }
          });
        }

        // 1) Problem Layer 분해 (순수 문제 이미지/PDF 보드만 보존, 내부 필기는 ink 채널로 격리)
        let cleanPrimaryProb = null;
        let primaryProbInk = null;
        if (s.primaryProblemCard && typeof s.primaryProblemCard === 'object') {
          cleanPrimaryProb = JSON.parse(JSON.stringify(s.primaryProblemCard));
          primaryProbInk = Array.isArray(cleanPrimaryProb.problemInkStrokes) ? cleanPrimaryProb.problemInkStrokes : [];
          cleanPrimaryProb.problemInkStrokes = [];
          hasProbContent = true;
          if (primaryProbInk.length > 0) hasInkContent = true;
        }

        const cleanExtraProbs = [];
        const extraProbsInk = [];
        if (Array.isArray(s.extraProblems)) {
          s.extraProblems.forEach((ep) => {
            if (!ep || typeof ep !== 'object') {
              cleanExtraProbs.push(ep);
              extraProbsInk.push(null);
              return;
            }
            hasProbContent = true;
            const cp = JSON.parse(JSON.stringify(ep));
            const hadProbInkProp = Object.prototype.hasOwnProperty.call(cp, 'problemInkStrokes');
            const hadCardInkProp = Object.prototype.hasOwnProperty.call(cp, 'cardInkStrokes');
            const pStrokes = Array.isArray(cp.problemInkStrokes) ? cp.problemInkStrokes : [];
            const cStrokes = Array.isArray(cp.cardInkStrokes) ? cp.cardInkStrokes : [];
            if (pStrokes.length > 0 || cStrokes.length > 0) hasInkContent = true;
            if (hadProbInkProp) cp.problemInkStrokes = [];
            if (hadCardInkProp) cp.cardInkStrokes = [];
            cleanExtraProbs.push(cp);
            extraProbsInk.push({
              hadProbInkProp,
              hadCardInkProp,
              problemInkStrokes: pStrokes,
              cardInkStrokes: cStrokes
            });
          });
        }

        const cleanPdfBoard = s.pdfPageBoardData ? JSON.parse(JSON.stringify(s.pdfPageBoardData)) : null;
        if (cleanPdfBoard || probStickersIndexed.length > 0) hasProbContent = true;

        probSlides.push({
          primaryProblemCard: cleanPrimaryProb,
          extraProblems: cleanExtraProbs,
          pdfPageBoardData: cleanPdfBoard,
          probStickersIndexed
        });

        // 2) Graph Layer 분해 (순수 그래프 카드/스냅샷/백업/실시간 함수만 보존, 내부 필기는 ink 채널로 격리)
        let cleanPrimaryGraph = null;
        let primaryGraphInk = null;
        if (s.primaryGraphCard && typeof s.primaryGraphCard === 'object') {
          hasGraphContent = true;
          cleanPrimaryGraph = JSON.parse(JSON.stringify(s.primaryGraphCard));
          const gCardStrokes = Array.isArray(cleanPrimaryGraph.graphInkStrokes) ? cleanPrimaryGraph.graphInkStrokes : [];
          cleanPrimaryGraph.graphInkStrokes = [];

          let primarySnapStrokes = null;
          if (cleanPrimaryGraph.primaryGraphCardSnapshot) {
            const sp = splitGraphSnapshotInk(cleanPrimaryGraph.primaryGraphCardSnapshot);
            cleanPrimaryGraph.primaryGraphCardSnapshot = sp.cleanSnap;
            primarySnapStrokes = sp.strokes;
          }
          let cardDataSnapStrokes = null;
          if (cleanPrimaryGraph.graphCardData && cleanPrimaryGraph.graphCardData.graphSnapshot) {
            const sp2 = splitGraphSnapshotInk(cleanPrimaryGraph.graphCardData.graphSnapshot);
            cleanPrimaryGraph.graphCardData.graphSnapshot = sp2.cleanSnap;
            cardDataSnapStrokes = sp2.strokes;
          }
          if (
            gCardStrokes.length > 0 ||
            (Array.isArray(primarySnapStrokes) && primarySnapStrokes.length > 0) ||
            (Array.isArray(cardDataSnapStrokes) && cardDataSnapStrokes.length > 0)
          ) {
            hasInkContent = true;
          }
          primaryGraphInk = {
            graphInkStrokes: gCardStrokes,
            primarySnapStrokes,
            cardDataSnapStrokes
          };
        }

        const cleanExtraGraphs = [];
        const extraGraphsInk = [];
        if (Array.isArray(s.extraGraphs)) {
          s.extraGraphs.forEach((eg) => {
            if (!eg || typeof eg !== 'object') {
              cleanExtraGraphs.push(eg);
              extraGraphsInk.push(null);
              return;
            }
            hasGraphContent = true;
            const cg = JSON.parse(JSON.stringify(eg));
            const hadGraphInkProp = Object.prototype.hasOwnProperty.call(cg, 'graphInkStrokes');
            const hadCardInkProp = Object.prototype.hasOwnProperty.call(cg, 'cardInkStrokes');
            const gStrokes = Array.isArray(cg.graphInkStrokes) ? cg.graphInkStrokes : [];
            const cStrokes = Array.isArray(cg.cardInkStrokes) ? cg.cardInkStrokes : [];
            let snapStrokes = null;
            if (cg.graphSnapshot) {
              const sp = splitGraphSnapshotInk(cg.graphSnapshot);
              cg.graphSnapshot = sp.cleanSnap;
              snapStrokes = sp.strokes;
            }
            if (
              gStrokes.length > 0 ||
              cStrokes.length > 0 ||
              (Array.isArray(snapStrokes) && snapStrokes.length > 0)
            ) {
              hasInkContent = true;
            }
            if (hadGraphInkProp) cg.graphInkStrokes = [];
            if (hadCardInkProp) cg.cardInkStrokes = [];
            cleanExtraGraphs.push(cg);
            extraGraphsInk.push({
              hadGraphInkProp,
              hadCardInkProp,
              graphInkStrokes: gStrokes,
              cardInkStrokes: cStrokes,
              snapStrokes
            });
          });
        }

        const cleanCoveredBackup = s.coveredGraphStateBackup ? JSON.parse(JSON.stringify(s.coveredGraphStateBackup)) : null;
        if (
          cleanCoveredBackup ||
          graphStickersIndexed.length > 0 ||
          (Array.isArray(historyGraph.graphs) && historyGraph.graphs.length > 0) ||
          (Array.isArray(historyGraph.dropLines) && historyGraph.dropLines.length > 0) ||
          (Array.isArray(historyGraph.textLabels) && historyGraph.textLabels.length > 0) ||
          Boolean(historyGraph.usePiecewise)
        ) {
          hasGraphContent = true;
        }

        graphSlides.push({
          primaryGraphCard: cleanPrimaryGraph,
          extraGraphs: cleanExtraGraphs,
          coveredGraphStateBackup: cleanCoveredBackup,
          historyGraph,
          graphStickersIndexed
        });

        // 3) Ink Layer 분해
        if (boardInkStrokes.length > 0 || inkStickersIndexed.length > 0) {
          hasInkContent = true;
        }
        inkSlides.push({
          boardInkStrokes,
          inkStickersIndexed,
          primaryProblemInk: primaryProbInk,
          extraProblemsInk: extraProbsInk,
          primaryGraphInk,
          extraGraphsInk
        });

        // 4) Audio Layer 분해 (skeleton에는 durationMs 경량 스텁 메타만 남김)
        let audioStubMeta = null;
        if (s.audioSyncData && typeof s.audioSyncData === 'object') {
          const compactedAudio = (typeof this._compactAudioSyncData === 'function' && !s.audioSyncData._compact && !s.audioSyncData._isLazyAudioStub)
            ? this._compactAudioSyncData(s.audioSyncData)
            : s.audioSyncData;
          if (compactedAudio && !compactedAudio._isLazyAudioStub) {
            audioMap[idx] = compactedAudio;
            hasAudioContent = true;
          }
          if (Number(s.audioSyncData.durationMs) > 0) {
            audioStubMeta = {
              durationMs: s.audioSyncData.durationMs,
              stageW: s.audioSyncData.stageW || 1440,
              stageH: s.audioSyncData.stageH || 900,
              createdAt: s.audioSyncData.createdAt || vaultUpdatedAt
            };
          }
        }

        // 5) Snapshot Layer 분해 (무필기 PDF 통페이지는 __SAME_AS_PDF_BOARD__ 중복 제거 토큰으로 저장!)
        let snapEntry = null;
        const hasSnapProps = Boolean(
          s.viewerSnapshotDataUrl ||
          s.viewerSnapshotWidth !== undefined ||
          s.viewerSnapshotHeight !== undefined ||
          s.viewerGraphHotspots !== undefined ||
          s.viewerStickerHotspots !== undefined ||
          s.viewerSmartBounds !== undefined ||
          s._viewerHiResRendered !== undefined
        );
        if (hasSnapProps) {
          hasSnapContent = true;
          const dedupSnapUrl = (s.pdfPageBoardData && s.pdfPageBoardData.dataUrl && s.viewerSnapshotDataUrl === s.pdfPageBoardData.dataUrl)
            ? '__SAME_AS_PDF_BOARD__'
            : s.viewerSnapshotDataUrl;
          snapEntry = {};
          if (s.viewerSnapshotDataUrl !== undefined) snapEntry.viewerSnapshotDataUrl = dedupSnapUrl;
          if (s.viewerSnapshotWidth !== undefined) snapEntry.viewerSnapshotWidth = s.viewerSnapshotWidth;
          if (s.viewerSnapshotHeight !== undefined) snapEntry.viewerSnapshotHeight = s.viewerSnapshotHeight;
          if (s.viewerGraphHotspots !== undefined) snapEntry.viewerGraphHotspots = s.viewerGraphHotspots;
          if (s.viewerStickerHotspots !== undefined) snapEntry.viewerStickerHotspots = s.viewerStickerHotspots;
          if (s.viewerSmartBounds !== undefined) snapEntry.viewerSmartBounds = s.viewerSmartBounds;
          if (s._viewerHiResRendered !== undefined) snapEntry._viewerHiResRendered = s._viewerHiResRendered;
        }
        snapSlides.push(snapEntry);

        // 6) Skeleton Layer (좌표계·뷰포트·슬라이드 기본 뼈대)
        skeletonSlides.push({
          version: s.version || '2.0',
          slideTitle: s.slideTitle !== undefined ? s.slideTitle : '문항',
          timestamp: s.timestamp || vaultUpdatedAt,
          isGraphCovered: s.isGraphCovered !== undefined ? Boolean(s.isGraphCovered) : true,
          savedLayer2BoardPan: s.savedLayer2BoardPan || null,
          suspendedPdfBoardState: s.suspendedPdfBoardState || null,
          retainedPdfAudioProbCard: Boolean(s.retainedPdfAudioProbCard),
          graphSessionArchived: Boolean(s.graphSessionArchived),
          graphCaseCounter: s.graphCaseCounter || 0,
          hasHistoryJson,
          historyWasString,
          hadBoardStickersProp,
          hadGraphHistoryKeys: Object.keys(historyGraph),
          historyBase,
          audioStubMeta,
          extraRootFields: Object.keys(extraRootFields).length > 0 ? extraRootFields : null
        });
      }

      return {
        skeleton: { v: 1, vaultUpdatedAt, slideCount: slides.length, slides: skeletonSlides },
        prob: { v: 1, vaultUpdatedAt, slides: probSlides },
        graph: { v: 1, vaultUpdatedAt, slides: graphSlides },
        ink: { v: 1, vaultUpdatedAt, slides: inkSlides },
        audio: { v: 1, vaultUpdatedAt, audioMap },
        snap: { v: 1, vaultUpdatedAt, slides: snapSlides },
        presence: {
          sk: true,
          pr: hasProbContent,
          gr: hasGraphContent,
          ik: hasInkContent,
          au: hasAudioContent,
          sn: hasSnapContent
        }
      };
    }

    _recomposeSlidesFromVaultLayers(layers, filterOpts = null, audioVaultKey = '') {
      if (!layers || !layers.skeleton || !Array.isArray(layers.skeleton.slides)) {
        return [];
      }
      const incProb = !filterOpts || filterOpts.includeProblem !== false;
      const incGraph = !filterOpts || filterOpts.includeGraph !== false;
      const incInk = !filterOpts || filterOpts.includeInk !== false;
      const incAudio = !filterOpts || filterOpts.includeAudio !== false;

      const injectGraphSnapshotInk = (snapVal, strokes) => {
        if (!snapVal || !Array.isArray(strokes)) return snapVal;
        if (typeof snapVal === 'object') {
          const cloned = JSON.parse(JSON.stringify(snapVal));
          cloned.graphInkStrokes = JSON.parse(JSON.stringify(strokes));
          return cloned;
        }
        if (typeof snapVal === 'string') {
          try {
            const parsed = JSON.parse(snapVal);
            if (parsed && typeof parsed === 'object') {
              parsed.graphInkStrokes = JSON.parse(JSON.stringify(strokes));
              return JSON.stringify(parsed);
            }
          } catch (e) { }
        }
        return snapVal;
      };

      const skSlides = layers.skeleton.slides;
      const prSlides = (incProb && layers.prob && Array.isArray(layers.prob.slides)) ? layers.prob.slides : null;
      const grSlides = (incGraph && layers.graph && Array.isArray(layers.graph.slides)) ? layers.graph.slides : null;
      const ikSlides = (incInk && layers.ink && Array.isArray(layers.ink.slides)) ? layers.ink.slides : null;
      const snSlides = (incProb && incGraph && incInk && layers.snap && Array.isArray(layers.snap.slides)) ? layers.snap.slides : null;
      const audioMap = (incAudio && layers.audio && layers.audio.audioMap && typeof layers.audio.audioMap === 'object')
        ? layers.audio.audioMap
        : null;

      const outSlides = [];
      for (let idx = 0; idx < skSlides.length; idx++) {
        const sk = skSlides[idx] || {};
        const pr = prSlides ? prSlides[idx] : null;
        const gr = grSlides ? grSlides[idx] : null;
        const ik = ikSlides ? ikSlides[idx] : null;
        const sn = snSlides ? snSlides[idx] : null;

        const slide = sk.extraRootFields ? JSON.parse(JSON.stringify(sk.extraRootFields)) : {};
        slide.version = sk.version || '2.0';
        slide.slideTitle = sk.slideTitle !== undefined ? sk.slideTitle : '문항';
        slide.timestamp = sk.timestamp || Date.now();
        slide.isGraphCovered = sk.isGraphCovered !== undefined ? Boolean(sk.isGraphCovered) : true;
        slide.coveredGraphStateBackup = null;
        slide.savedLayer2BoardPan = sk.savedLayer2BoardPan ? JSON.parse(JSON.stringify(sk.savedLayer2BoardPan)) : null;
        slide.suspendedPdfBoardState = sk.suspendedPdfBoardState ? JSON.parse(JSON.stringify(sk.suspendedPdfBoardState)) : null;
        slide.retainedPdfAudioProbCard = Boolean(sk.retainedPdfAudioProbCard);
        slide.graphSessionArchived = Boolean(sk.graphSessionArchived);
        slide.graphCaseCounter = sk.graphCaseCounter || 0;

        // 1) Problem 복원 + (필기 허용 시) 문제 필기 결합
        if (incProb && pr) {
          slide.primaryProblemCard = pr.primaryProblemCard ? JSON.parse(JSON.stringify(pr.primaryProblemCard)) : null;
          slide.extraProblems = Array.isArray(pr.extraProblems) ? JSON.parse(JSON.stringify(pr.extraProblems)) : [];
          slide.pdfPageBoardData = pr.pdfPageBoardData ? JSON.parse(JSON.stringify(pr.pdfPageBoardData)) : null;

          if (incInk && ik) {
            if (slide.primaryProblemCard) {
              slide.primaryProblemCard.problemInkStrokes = Array.isArray(ik.primaryProblemInk)
                ? JSON.parse(JSON.stringify(ik.primaryProblemInk))
                : [];
            }
            if (Array.isArray(slide.extraProblems) && Array.isArray(ik.extraProblemsInk)) {
              slide.extraProblems.forEach((ep, k) => {
                const epInk = ik.extraProblemsInk[k];
                if (!ep || !epInk) return;
                if (epInk.hadProbInkProp) {
                  ep.problemInkStrokes = JSON.parse(JSON.stringify(epInk.problemInkStrokes || []));
                }
                if (epInk.hadCardInkProp || Array.isArray(epInk.cardInkStrokes)) {
                  ep.cardInkStrokes = JSON.parse(JSON.stringify(epInk.cardInkStrokes || []));
                }
              });
            }
          } else {
            if (slide.primaryProblemCard) {
              slide.primaryProblemCard.problemInkStrokes = [];
            }
            slide.extraProblems.forEach((ep) => {
              if (ep) {
                ep.problemInkStrokes = [];
                ep.cardInkStrokes = [];
              }
            });
          }
        } else {
          slide.primaryProblemCard = null;
          slide.extraProblems = [];
          slide.pdfPageBoardData = null;
        }

        // 2) Graph 복원 + (필기 허용 시) 그래프 필기 결합
        if (incGraph && gr) {
          slide.primaryGraphCard = gr.primaryGraphCard ? JSON.parse(JSON.stringify(gr.primaryGraphCard)) : null;
          slide.extraGraphs = Array.isArray(gr.extraGraphs) ? JSON.parse(JSON.stringify(gr.extraGraphs)) : [];
          slide.coveredGraphStateBackup = gr.coveredGraphStateBackup ? JSON.parse(JSON.stringify(gr.coveredGraphStateBackup)) : null;

          if (incInk && ik) {
            if (slide.primaryGraphCard && ik.primaryGraphInk) {
              slide.primaryGraphCard.graphInkStrokes = JSON.parse(JSON.stringify(ik.primaryGraphInk.graphInkStrokes || []));
              if (slide.primaryGraphCard.primaryGraphCardSnapshot && Array.isArray(ik.primaryGraphInk.primarySnapStrokes)) {
                slide.primaryGraphCard.primaryGraphCardSnapshot = injectGraphSnapshotInk(
                  slide.primaryGraphCard.primaryGraphCardSnapshot,
                  ik.primaryGraphInk.primarySnapStrokes
                );
              }
              if (slide.primaryGraphCard.graphCardData && slide.primaryGraphCard.graphCardData.graphSnapshot && Array.isArray(ik.primaryGraphInk.cardDataSnapStrokes)) {
                slide.primaryGraphCard.graphCardData.graphSnapshot = injectGraphSnapshotInk(
                  slide.primaryGraphCard.graphCardData.graphSnapshot,
                  ik.primaryGraphInk.cardDataSnapStrokes
                );
              }
            }
            if (Array.isArray(slide.extraGraphs) && Array.isArray(ik.extraGraphsInk)) {
              slide.extraGraphs.forEach((eg, k) => {
                const egInk = ik.extraGraphsInk[k];
                if (!eg || !egInk) return;
                if (egInk.hadGraphInkProp) {
                  eg.graphInkStrokes = JSON.parse(JSON.stringify(egInk.graphInkStrokes || []));
                }
                if (egInk.hadCardInkProp || Array.isArray(egInk.cardInkStrokes)) {
                  eg.cardInkStrokes = JSON.parse(JSON.stringify(egInk.cardInkStrokes || []));
                }
                if (eg.graphSnapshot && Array.isArray(egInk.snapStrokes)) {
                  eg.graphSnapshot = injectGraphSnapshotInk(eg.graphSnapshot, egInk.snapStrokes);
                }
              });
            }
          } else {
            if (slide.primaryGraphCard) {
              slide.primaryGraphCard.graphInkStrokes = [];
            }
            slide.extraGraphs.forEach((eg) => {
              if (eg) {
                eg.graphInkStrokes = [];
                eg.cardInkStrokes = [];
              }
            });
          }
        } else {
          slide.primaryGraphCard = null;
          slide.extraGraphs = [];
          slide.coveredGraphStateBackup = null;
        }

        // 3) HistoryJson 재조립
        if (sk.hasHistoryJson) {
          const hObj = sk.historyBase ? JSON.parse(JSON.stringify(sk.historyBase)) : {};
          if (incGraph && gr && gr.historyGraph && typeof gr.historyGraph === 'object') {
            Object.keys(gr.historyGraph).forEach((gk) => {
              hObj[gk] = JSON.parse(JSON.stringify(gr.historyGraph[gk]));
            });
          } else {
            const origGraphKeys = Array.isArray(sk.hadGraphHistoryKeys) ? sk.hadGraphHistoryKeys : [];
            if (origGraphKeys.includes('activeGraphIdx')) hObj.activeGraphIdx = -1;
            if (origGraphKeys.includes('piecewiseBoundaries')) hObj.piecewiseBoundaries = [];
            if (origGraphKeys.includes('piecewiseFuncMap')) hObj.piecewiseFuncMap = [];
            if (origGraphKeys.includes('piecewiseInclusions')) hObj.piecewiseInclusions = [];
            if (origGraphKeys.includes('isPiecewisePeriodic')) hObj.isPiecewisePeriodic = false;
            if (origGraphKeys.includes('periodicStepY')) hObj.periodicStepY = 0;
            if (origGraphKeys.includes('isPiecewiseLocked')) hObj.isPiecewiseLocked = false;
            if (origGraphKeys.includes('showInverseGuide')) hObj.showInverseGuide = false;
            hObj.graphs = [];
            hObj.dropLines = [];
            hObj.textLabels = [];
            hObj.usePiecewise = false;
          }

          hObj.inkStrokes = (incInk && ik && Array.isArray(ik.boardInkStrokes))
            ? JSON.parse(JSON.stringify(ik.boardInkStrokes))
            : [];

          const combinedStickers = [];
          if (incProb && pr && Array.isArray(pr.probStickersIndexed)) {
            combinedStickers.push(...pr.probStickersIndexed);
          }
          if (incGraph && gr && Array.isArray(gr.graphStickersIndexed)) {
            combinedStickers.push(...gr.graphStickersIndexed);
          }
          if (incInk && ik && Array.isArray(ik.inkStickersIndexed)) {
            combinedStickers.push(...ik.inkStickersIndexed);
          }
          if (sk.hadBoardStickersProp || combinedStickers.length > 0) {
            combinedStickers.sort((a, b) => (a.order || 0) - (b.order || 0));
            hObj.boardStickers = combinedStickers.map(entry => JSON.parse(JSON.stringify(entry.stk)));
          }

          // 그래프만 단독 공유 시(!incProb && !incInk && incGraph) 칠판 덮개 아래 백업된 실시간 그래프 자동 언커버
          if (!incProb && !incInk && incGraph && slide.isGraphCovered && !slide.primaryGraphCard && (!slide.extraGraphs || slide.extraGraphs.length === 0)) {
            if ((!hObj.graphs || hObj.graphs.length === 0) && slide.coveredGraphStateBackup && Array.isArray(slide.coveredGraphStateBackup.graphs) && slide.coveredGraphStateBackup.graphs.length > 0) {
              hObj.graphs = JSON.parse(JSON.stringify(slide.coveredGraphStateBackup.graphs));
            }
            slide.isGraphCovered = false;
          }

          slide.historyJson = sk.historyWasString ? JSON.stringify(hObj) : hObj;
        } else {
          slide.historyJson = null;
        }

        // 4) Audio 복원 또는 온디맨드 Lazy Stub 장착
        if (!incAudio) {
          slide.audioSyncData = null;
        } else if (audioMap && audioMap[idx]) {
          const rawAud = JSON.parse(JSON.stringify(audioMap[idx]));
          slide.audioSyncData = (!incProb || !incGraph || !incInk)
            ? this._applyExportFilterToAudioSyncData(rawAud, { includeProblem: incProb, includeGraph: incGraph, includeInk: incInk })
            : rawAud;
        } else if (audioVaultKey && sk.audioStubMeta && Number(sk.audioStubMeta.durationMs) > 0) {
          slide.audioSyncData = {
            durationMs: sk.audioStubMeta.durationMs,
            stageW: sk.audioStubMeta.stageW || 1440,
            stageH: sk.audioStubMeta.stageH || 900,
            createdAt: sk.audioStubMeta.createdAt || Date.now(),
            _isLazyAudioStub: true,
            _lazySlideIdx: idx
          };
        } else {
          slide.audioSyncData = null;
        }

        // 5) Snapshot 복원 (전체 통합본 공유 시 0.00초 즉시 오픈용)
        if (sn && typeof sn === 'object') {
          const clonedSn = JSON.parse(JSON.stringify(sn));
          Object.keys(clonedSn).forEach((skKey) => {
            slide[skKey] = clonedSn[skKey];
          });
        }

        outSlides.push(slide);
      }

      const wrapper = { playlistSlides: outSlides, exportFilter: filterOpts || null };
      this._restoreDeduplicatedSlideSnapshots(wrapper);
      return wrapper.playlistSlides;
    }

    async _prepareCloudVaultCompressedBundle(slides, vaultUpdatedAt = Date.now()) {
      const decomposed = this._decomposeSlidesIntoVaultLayers(slides, vaultUpdatedAt);
      const channelSpecs = [
        { code: 'sk', prop: 'skeleton', keyProp: 'skeletonKey' },
        { code: 'pr', prop: 'prob', keyProp: 'probKey' },
        { code: 'gr', prop: 'graph', keyProp: 'graphKey' },
        { code: 'ik', prop: 'ink', keyProp: 'inkKey' },
        { code: 'au', prop: 'audio', keyProp: 'audioKey' },
        { code: 'sn', prop: 'snap', keyProp: 'snapKey' }
      ];
      const CHUNK_LIMIT = 700000;
      const preparedLayers = {};
      const vaultLayerMeta = {};
      let totalByteSize = 0;
      let totalRawByteSize = 0;

      await Promise.all(channelSpecs.map(async (spec) => {
        const exists = Boolean(decomposed.presence[spec.code]);
        if (!exists) {
          vaultLayerMeta[spec.code] = { exists: false, chunks: 0, bytes: 0 };
          return;
        }
        const rawJson = JSON.stringify(decomposed[spec.prop]);
        const netStr = await this._compressJsonStringGzipBase64(rawJson);
        const rawBytes = this._measureUtf8Bytes(rawJson);
        const netBytes = this._measureUtf8Bytes(netStr);
        const escapedBytes = this._measureJsonEscapedUtf8Bytes(netStr);
        const chunks = escapedBytes > CHUNK_LIMIT
          ? this._splitStringIntoSafeFirestoreChunks(netStr, CHUNK_LIMIT)
          : null;
        if (chunks && chunks.length > 999) {
          throw new Error('VAULT_LAYER_CHUNK_LIMIT_EXCEEDED');
        }
        preparedLayers[spec.code] = {
          code: spec.code,
          keyProp: spec.keyProp,
          netStr,
          chunks,
          chunkCount: chunks ? chunks.length : 0,
          byteSize: netBytes,
          rawByteSize: rawBytes
        };
        vaultLayerMeta[spec.code] = {
          exists: true,
          chunks: chunks ? chunks.length : 0,
          bytes: netBytes
        };
        totalByteSize += netBytes;
        totalRawByteSize += rawBytes;
      }));

      return {
        vaultUpdatedAt,
        preparedLayers,
        vaultLayerMeta,
        totalByteSize,
        totalRawByteSize
      };
    }

    async _writeCloudVaultSingleLayer(vaultKey, layerPrep, prevChunkCount = 0, baseUid = '') {
      const effUid = baseUid || ((this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'anonymous');
      const chunkOwnerUid = `chunk_${effUid}`;
      const newChunkCount = (layerPrep && layerPrep.chunks) ? layerPrep.chunks.length : 0;

      if (!layerPrep) {
        await this._deleteCloudVaultSingleLayer(vaultKey, prevChunkCount);
        return;
      }

      if (newChunkCount > 0 && Array.isArray(layerPrep.chunks)) {
        const BATCH_SIZE = 6;
        for (let b = 0; b < newChunkCount; b += BATCH_SIZE) {
          const batchSlice = layerPrep.chunks.slice(b, b + BATCH_SIZE);
          await Promise.all(batchSlice.map((cStr, localIdx) => {
            const idx = b + localIdx;
            return this._firestoreRestWriteSingleDoc(
              'cloud_share_vault',
              `${vaultKey}_part_${idx}`,
              JSON.stringify({ _isChunkPart: true, parentId: vaultKey, partIndex: idx, data: cStr }),
              { ownerUid: chunkOwnerUid, expireAtMs: 0 }
            );
          }));
        }
        const manifestPayload = JSON.stringify({
          _isVaultChunkManifest: true,
          vaultKey,
          chunkCount: newChunkCount,
          byteSize: layerPrep.byteSize,
          updatedAt: Date.now()
        });
        await this._firestoreRestWriteSingleDoc('cloud_share_vault', vaultKey, manifestPayload, {
          ownerUid: effUid,
          expireAtMs: 0
        });
      } else {
        await this._firestoreRestWriteSingleDoc('cloud_share_vault', vaultKey, layerPrep.netStr, {
          ownerUid: effUid,
          expireAtMs: 0
        });
      }

      // 덮어쓰기 시 이전에 분할 청크가 더 많았으면 남은 꼬리 청크 자동 청소
      if (prevChunkCount > newChunkCount) {
        const tailCleanTasks = [];
        for (let ci = newChunkCount; ci < prevChunkCount; ci++) {
          tailCleanTasks.push(this._firestoreRestDeleteDoc('cloud_share_vault', `${vaultKey}_part_${ci}`).catch(() => { }));
        }
        if (tailCleanTasks.length) {
          await Promise.all(tailCleanTasks);
        }
      }

      if (typeof this._idbCacheSet === 'function') {
        await this._idbCacheSet('graphly_vault_layer_' + vaultKey, layerPrep.netStr, 0).catch(() => { });
      }
    }

    async _deleteCloudVaultSingleLayer(vaultKey, maxChunkCount = 0) {
      if (!vaultKey) return;
      if (typeof this._idbCacheDelete === 'function') {
        await this._idbCacheDelete('graphly_vault_layer_' + vaultKey).catch(() => { });
      }
      let effChunks = Math.max(0, Number(maxChunkCount) || 0);
      if (effChunks === 0 && typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/cloud_share_vault/${encodeURIComponent(vaultKey)}`;
          const r = await fetch(url);
          if (r && r.ok) {
            const d = await r.json();
            if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
              const rawVal = await this._decompressJsonStringGzipBase64(d.fields.jsonPayload.stringValue);
              const parsed = JSON.parse(rawVal);
              if (parsed && parsed._isVaultChunkManifest && Number(parsed.chunkCount) > 0) {
                effChunks = Number(parsed.chunkCount) || 0;
              }
            }
          }
        } catch (_) { }
      }
      const delTasks = [this._firestoreRestDeleteDoc('cloud_share_vault', vaultKey).catch(() => { })];
      for (let i = 0; i < effChunks; i++) {
        delTasks.push(this._firestoreRestDeleteDoc('cloud_share_vault', `${vaultKey}_part_${i}`).catch(() => { }));
      }
      await Promise.all(delTasks);
    }

    async _deleteCloudVaultLayersFromServer(item) {
      if (!item || !item.vaultKeys || typeof item.vaultKeys !== 'object') return;
      const vk = item.vaultKeys;
      const meta = (item.vaultLayerMeta && typeof item.vaultLayerMeta === 'object') ? item.vaultLayerMeta : {};
      const pairs = [
        [vk.skeletonKey, meta.sk && meta.sk.chunks],
        [vk.probKey, meta.pr && meta.pr.chunks],
        [vk.graphKey, meta.gr && meta.gr.chunks],
        [vk.inkKey, meta.ik && meta.ik.chunks],
        [vk.audioKey, meta.au && meta.au.chunks],
        [vk.snapKey, meta.sn && meta.sn.chunks]
      ];
      await Promise.all(pairs.map(([key, cnt]) => key ? this._deleteCloudVaultSingleLayer(key, cnt) : Promise.resolve()));
    }

    async _readCloudVaultLayerData(vaultKey, skipLocalCache = false) {
      if (!vaultKey) return null;
      if (!skipLocalCache && typeof this._idbCacheGet === 'function') {
        try {
          const cachedStr = await this._idbCacheGet('graphly_vault_layer_' + vaultKey);
          if (cachedStr) {
            const uncomp = typeof cachedStr === 'string'
              ? await this._decompressJsonStringGzipBase64(cachedStr)
              : JSON.stringify(cachedStr);
            const parsed = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
            if (parsed && !parsed._isVaultChunkManifest) {
              return parsed;
            }
          }
        } catch (e) { }
      }

      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return null;
      }

      const rootUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/cloud_share_vault/${encodeURIComponent(vaultKey)}`;
      const res = await this._fetchFirestoreDocWithRetry(rootUrl);
      if (!res || !res.ok) return null;
      const data = await res.json();
      if (!data || !data.fields || !data.fields.jsonPayload || !data.fields.jsonPayload.stringValue) {
        return null;
      }

      const rawRootStr = data.fields.jsonPayload.stringValue;
      const uncompRoot = await this._decompressJsonStringGzipBase64(rawRootStr);
      const parsedRoot = JSON.parse(uncompRoot);

      if (parsedRoot && parsedRoot._isVaultChunkManifest && Number(parsedRoot.chunkCount) > 0) {
        const expectedCount = Number(parsedRoot.chunkCount) || 0;
        const indices = Array.from({ length: expectedCount }, (_, i) => i);
        const parts = await Promise.all(indices.map(async (idx) => {
          const partUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/cloud_share_vault/${encodeURIComponent(`${vaultKey}_part_${idx}`)}`;
          const r = await this._fetchFirestoreDocWithRetry(partUrl);
          if (!r || !r.ok) return null;
          const d = await r.json();
          if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
            const pObj = JSON.parse(d.fields.jsonPayload.stringValue);
            if (typeof pObj.data === 'string' && pObj.data.length > 0) {
              return pObj.data;
            }
          }
          return null;
        }));
        const allOk = expectedCount > 0 && parts.length === expectedCount && parts.every(p => typeof p === 'string' && p.length > 0);
        if (!allOk) return null;
        const joined = parts.join('');
        const decompJoined = await this._decompressJsonStringGzipBase64(joined);
        const fullLayerObj = JSON.parse(decompJoined);
        if (typeof this._idbCacheSet === 'function') {
          await this._idbCacheSet('graphly_vault_layer_' + vaultKey, joined, 0).catch(() => { });
        }
        return fullLayerObj;
      }

      if (typeof this._idbCacheSet === 'function') {
        await this._idbCacheSet('graphly_vault_layer_' + vaultKey, rawRootStr, 0).catch(() => { });
      }
      return parsedRoot;
    }

    async _resolveVaultPointerSharePackage(pointerPkg, skipLocalCache = false) {
      if (!pointerPkg || !pointerPkg.vaultRefs) return pointerPkg;
      const refs = pointerPkg.vaultRefs;
      if (!refs.skeletonKey) {
        return { ...pointerPkg, _vaultOriginDeleted: true, playlistSlides: [] };
      }

      const [skeletonData, probData, graphData, inkData, snapData] = await Promise.all([
        this._readCloudVaultLayerData(refs.skeletonKey, skipLocalCache),
        refs.probKey ? this._readCloudVaultLayerData(refs.probKey, skipLocalCache) : Promise.resolve(null),
        refs.graphKey ? this._readCloudVaultLayerData(refs.graphKey, skipLocalCache) : Promise.resolve(null),
        refs.inkKey ? this._readCloudVaultLayerData(refs.inkKey, skipLocalCache) : Promise.resolve(null),
        refs.snapKey ? this._readCloudVaultLayerData(refs.snapKey, skipLocalCache) : Promise.resolve(null)
      ]);

      if (!skeletonData || !Array.isArray(skeletonData.slides)) {
        return {
          ...pointerPkg,
          _vaultOriginDeleted: true,
          playlistSlides: []
        };
      }

      const effFilter = pointerPkg.exportFilter || {
        includeProblem: Boolean(refs.probKey),
        includeGraph: Boolean(refs.graphKey),
        includeInk: Boolean(refs.inkKey),
        includeAudio: Boolean(refs.audioKey)
      };
      const slides = this._recomposeSlidesFromVaultLayers(
        { skeleton: skeletonData, prob: probData, graph: graphData, ink: inkData, snap: snapData, audio: null },
        effFilter,
        refs.audioKey || ''
      );
      const hasAudioStub = Boolean(
        refs.audioKey && slides.some(s => s && s.audioSyncData && s.audioSyncData._isLazyAudioStub)
      );

      const assembled = {
        ...pointerPkg,
        playlistSlides: slides,
        isPlaylist: slides.length > 1 || Boolean(pointerPkg.isPlaylist),
        slideCount: slides.length,
        _fromVaultPointer: true,
        _vaultSkeletonKey: refs.skeletonKey,
        _vaultAudioKey: refs.audioKey || '',
        _vaultUpdatedAt: Number(skeletonData.vaultUpdatedAt) || Number(pointerPkg.vaultUpdatedAt) || 0,
        _hasLazyAudio: hasAudioStub,
        _lazyAudioLoaded: false
      };
      return this._restoreDeduplicatedSlideSnapshots(assembled);
    }

    async _resolveVaultLayeredLibraryItem(item, skipVaultCache = false) {
      if (!item || !item.vaultKeys || !item.vaultKeys.skeletonKey) return item;
      const vk = item.vaultKeys;
      const meta = (item.vaultLayerMeta && typeof item.vaultLayerMeta === 'object') ? item.vaultLayerMeta : null;
      const shouldFetch = (code, key) => Boolean(key && (!meta || !meta[code] || meta[code].exists !== false));

      const [skeletonData, probData, graphData, inkData, audioData, snapData] = await Promise.all([
        this._readCloudVaultLayerData(vk.skeletonKey, skipVaultCache),
        shouldFetch('pr', vk.probKey) ? this._readCloudVaultLayerData(vk.probKey, skipVaultCache) : Promise.resolve(null),
        shouldFetch('gr', vk.graphKey) ? this._readCloudVaultLayerData(vk.graphKey, skipVaultCache) : Promise.resolve(null),
        shouldFetch('ik', vk.inkKey) ? this._readCloudVaultLayerData(vk.inkKey, skipVaultCache) : Promise.resolve(null),
        shouldFetch('au', vk.audioKey) ? this._readCloudVaultLayerData(vk.audioKey, skipVaultCache) : Promise.resolve(null),
        shouldFetch('sn', vk.snapKey) ? this._readCloudVaultLayerData(vk.snapKey, skipVaultCache) : Promise.resolve(null)
      ]);

      if (!skeletonData || !Array.isArray(skeletonData.slides)) {
        return item;
      }

      const fullFilter = { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      const slides = this._recomposeSlidesFromVaultLayers(
        { skeleton: skeletonData, prob: probData, graph: graphData, ink: inkData, audio: audioData, snap: snapData },
        fullFilter,
        ''
      );

      const hydratedObj = {
        ...item,
        vaultUpdatedAt: Number(skeletonData.vaultUpdatedAt) || Number(item.vaultUpdatedAt) || Date.now(),
        playlistSlides: slides,
        slideData: null,
        slideCount: slides.length,
        isPlaylist: slides.length > 1 || Boolean(item.isPlaylist),
        _hasLazyAudio: false,
        _lazyAudioLoaded: true
      };

      if (item.id && typeof this._idbCacheSet === 'function') {
        const compFull = await this._compressJsonStringGzipBase64(this._stringifyWithDeduplicatedSnapshots(hydratedObj));
        await this._idbCacheSet('graphly_full_doc_' + item.id, compFull, 0).catch(() => { });
      }

      return this._restoreDeduplicatedSlideSnapshots(hydratedObj);
    }

    async _saveLibraryItemWithVaultOrFallback(itemObj, overwriteTarget = null, precomputedBundle = null, skipQuotaCheck = false, contextLabel = '클라우드 저장') {
      const baseUid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'anonymous';
      const nowMs = Date.now();
      const slides = Array.isArray(itemObj.playlistSlides)
        ? itemObj.playlistSlides
        : (itemObj.slideData ? [itemObj.slideData] : []);

      const bundle = precomputedBundle || await this._prepareCloudVaultCompressedBundle(slides, nowMs);
      itemObj.byteSize = bundle.totalByteSize;
      itemObj.rawByteSize = bundle.totalRawByteSize;

      if (!skipQuotaCheck) {
        const replacingBytes = overwriteTarget
          ? (Number(overwriteTarget.byteSize) || Number(overwriteTarget.rawByteSize) || 0)
          : 0;
        if (!this.checkCanUploadBytesToCloud(itemObj.byteSize, replacingBytes, contextLabel)) {
          return { ok: false, reason: 'QUOTA_EXCEEDED' };
        }
      }

      // 덮어쓰기 시 기존 파일 ID · 생성일 · 고정 볼트 키(vaultKeys) · 발급된 모든 공유 주소표(_shareLinksMap)를 100% 승계!
      if (overwriteTarget) {
        if (overwriteTarget.createdAt) itemObj.createdAt = overwriteTarget.createdAt;
        if (overwriteTarget.linkedShareId && !itemObj.linkedShareId) {
          itemObj.linkedShareId = overwriteTarget.linkedShareId;
        }
        if (overwriteTarget._tempShareId && !itemObj._tempShareId) {
          itemObj._tempShareId = overwriteTarget._tempShareId;
          itemObj._tempShareExpiresAt = overwriteTarget._tempShareExpiresAt || 0;
        }
        if (overwriteTarget._shareLinksMap && typeof overwriteTarget._shareLinksMap === 'object' && !itemObj._shareLinksMap) {
          itemObj._shareLinksMap = JSON.parse(JSON.stringify(overwriteTarget._shareLinksMap));
        }
      }

      const vaultKeys = (overwriteTarget && overwriteTarget.vaultKeys && overwriteTarget.vaultKeys.skeletonKey)
        ? { ...overwriteTarget.vaultKeys }
        : ((itemObj.vaultKeys && itemObj.vaultKeys.skeletonKey) ? { ...itemObj.vaultKeys } : this._generateCloudVaultKeys());
      const prevLayerMeta = (overwriteTarget && overwriteTarget.vaultLayerMeta && typeof overwriteTarget.vaultLayerMeta === 'object')
        ? overwriteTarget.vaultLayerMeta
        : {};

      try {
        const writePairs = [
          ['sk', vaultKeys.skeletonKey],
          ['pr', vaultKeys.probKey],
          ['gr', vaultKeys.graphKey],
          ['ik', vaultKeys.inkKey],
          ['au', vaultKeys.audioKey],
          ['sn', vaultKeys.snapKey]
        ];
        await Promise.all(writePairs.map(([code, vKey]) => {
          const layerPrep = bundle.preparedLayers[code] || null;
          const prevMetaEntry = prevLayerMeta[code];
          const prevChunks = prevMetaEntry ? (Number(prevMetaEntry.chunks) || 0) : 0;
          if (!layerPrep && (!prevMetaEntry || prevMetaEntry.exists === false)) {
            return Promise.resolve();
          }
          return this._writeCloudVaultSingleLayer(vKey, layerPrep, prevChunks, baseUid);
        }));

        itemObj.updatedAt = bundle.vaultUpdatedAt;
        itemObj.vaultUpdatedAt = bundle.vaultUpdatedAt;
        itemObj._isVaultLayered = true;
        itemObj.vaultKeys = vaultKeys;
        itemObj.vaultLayerMeta = bundle.vaultLayerMeta;
        itemObj._isChunked = false;
        itemObj._chunkCollection = '';
        itemObj._chunkDocPrefix = '';
        itemObj._chunkCount = 0;

        const manifestObj = {
          ...itemObj,
          slideData: null,
          playlistSlides: null
        };

        await this._firestoreRestWriteSingleDoc('user_library', itemObj.id, JSON.stringify(manifestObj), {
          ownerUid: baseUid,
          expireAtMs: 0
        });

        // 구버전 청크 파일에서 6-채널 볼트로 덮어쓰기 전환된 경우 남는 레거시 청크 정리
        if (overwriteTarget && overwriteTarget._isChunked && overwriteTarget._chunkDocPrefix && Number(overwriteTarget._chunkCount) > 0) {
          const oldCol = overwriteTarget._chunkCollection || 'user_library';
          const cleanTasks = [];
          for (let ci = 0; ci < Number(overwriteTarget._chunkCount); ci++) {
            cleanTasks.push(this._firestoreRestDeleteDoc(oldCol, `${overwriteTarget._chunkDocPrefix}${ci}`).catch(() => { }));
          }
          await Promise.all(cleanTasks);
        }

        if (typeof this._idbCacheSet === 'function') {
          const fullCompressed = await this._compressJsonStringGzipBase64(this._stringifyWithDeduplicatedSnapshots(itemObj));
          await this._idbCacheSet('graphly_full_doc_' + itemObj.id, fullCompressed, 0).catch(() => { });
          try { localStorage.removeItem('graphly_full_doc_' + itemObj.id); } catch (_) { }
        }

        const lightweightItem = { ...manifestObj };
        return { ok: true, usedVault: true, manifestItem: lightweightItem };
      } catch (vaultErr) {
        const errMsg = String((vaultErr && vaultErr.message) || vaultErr || '');
        // 새 firestore.rules 배포 전 환경(403)인 경우에만 기존 user_library 분할 저장으로 무중단 폴백
        if (errMsg.includes('403')) {
          try {
            delete itemObj._isVaultLayered;
            delete itemObj.vaultKeys;
            delete itemObj.vaultLayerMeta;
            await this._firestoreRestWrite('user_library', itemObj.id, itemObj);
            if (overwriteTarget && overwriteTarget._chunkDocPrefix && Number(overwriteTarget._chunkCount) > 0) {
              const oldPrefix = overwriteTarget._chunkDocPrefix || '';
              const newPrefix = itemObj._chunkDocPrefix || '';
              const oldCount = Number(overwriteTarget._chunkCount) || 0;
              const newCount = Number(itemObj._chunkCount) || 0;
              const oldCol = overwriteTarget._chunkCollection || 'user_library';
              const newCol = itemObj._chunkCollection || 'user_library';
              const startCleanIdx = (oldPrefix === newPrefix && oldCol === newCol) ? newCount : 0;
              const cleanTasks = [];
              for (let ci = startCleanIdx; ci < oldCount; ci++) {
                cleanTasks.push(this._firestoreRestDeleteDoc(oldCol, `${oldPrefix}${ci}`).catch(() => { }));
              }
              if (cleanTasks.length) await Promise.all(cleanTasks);
            }
            const lightweightFallback = { ...itemObj, slideData: null, playlistSlides: null };
            return { ok: true, usedVault: false, manifestItem: lightweightFallback };
          } catch (fbErr) {
            return { ok: false, reason: 'WRITE_FAILED', error: fbErr };
          }
        }
        return { ok: false, reason: 'WRITE_FAILED', error: vaultErr };
      }
    }

    // 🌟 [본인 소유 문서만 서버에서精准 필터링 조회 (Firestore 단일 필드 자동 인덱스 :runQuery 사용 — 남의 문서 다운로드 0%!)]
    async _firestoreRestQueryByOwner(collectionName, ownerUids, maxResults = 500) {
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return [];
      }
      const validUids = Array.from(new Set(
        (Array.isArray(ownerUids) ? ownerUids : [ownerUids])
          .map(u => String(u || '').trim())
          .filter(u => u && u !== 'anonymous' && u !== 'local_user')
      ));
      if (!validUids.length) return [];

      const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents:runQuery`;
      const fieldFilter = validUids.length === 1
        ? {
          field: { fieldPath: 'ownerUid' },
          op: 'EQUAL',
          value: { stringValue: validUids[0] }
        }
        : {
          field: { fieldPath: 'ownerUid' },
          op: 'IN',
          value: {
            arrayValue: {
              values: validUids.map(u => ({ stringValue: u }))
            }
          }
        };

      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          where: { fieldFilter },
          limit: maxResults
        }
      };

      const reqHeaders = await this._buildFirestoreRestHeaders(true, true);
      const res = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(queryBody)
      });
      if (!res.ok) return null;
      const rows = await res.json();
      if (!Array.isArray(rows)) return [];
      const items = [];
      for (let i = 0; i < rows.length; i++) {
        const doc = rows[i] && rows[i].document;
        if (!doc || !doc.fields || !doc.fields.jsonPayload || !doc.fields.jsonPayload.stringValue) continue;
        try {
          const rawCompressed = doc.fields.jsonPayload.stringValue;
          const rawVal = await this._decompressJsonStringGzipBase64(rawCompressed);
          const parsed = JSON.parse(rawVal);
          if (!parsed || parsed._isChunkPart) continue;
          if (!parsed.byteSize) {
            parsed.byteSize = rawCompressed.length;
          }
          if (parsed.id && ((Array.isArray(parsed.playlistSlides) && parsed.playlistSlides.length > 0) || parsed.slideData)) {
            this._idbCacheSet('graphly_full_doc_' + parsed.id, rawCompressed).catch(() => { });
          }
          items.push(parsed);
        } catch (e) { }
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return items;
    }

    async _firestoreRestListCollection(collectionName, pageSize = 50) {
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return [];
      }
      const reqHeaders = await this._buildFirestoreRestHeaders(false, false);
      const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}?pageSize=${pageSize}`;
      const res = await fetch(url, Object.keys(reqHeaders).length ? { headers: reqHeaders } : undefined);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !Array.isArray(data.documents)) return [];
      const items = [];
      for (let i = 0; i < data.documents.length; i++) {
        const doc = data.documents[i];
        try {
          if (doc.fields && doc.fields.jsonPayload && doc.fields.jsonPayload.stringValue) {
            const rawVal = await this._decompressJsonStringGzipBase64(doc.fields.jsonPayload.stringValue);
            items.push(JSON.parse(rawVal));
          }
        } catch (e) { }
      }
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return items;
    }

    async _firestoreRestDeleteDoc(collectionName, docId) {
      if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
        return;
      }
      const isPublicShare = (collectionName === 'shared_workspaces' && !this.cloudUser);
      const reqHeaders = await this._buildFirestoreRestHeaders(false, !isPublicShare);
      const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
      await fetch(url, {
        method: 'DELETE',
        headers: reqHeaders
      });
    }

    _isOwnedByCurrentCloudUser(item) {
      if (!this.cloudUser || !this.cloudUser.uid || !item || !item.ownerUid) return false;
      if (this.cloudUser.emailVerified === false) return false;
      if (item.ownerUid === 'local_user' || item.ownerUid === 'anonymous') return false;
      if (item.ownerUid === this.cloudUser.uid) return true;
      if (this.cloudUser.rawUid && item.ownerUid === this.cloudUser.rawUid) return true;
      const curEmail = String(this.cloudUser.email || '').trim().toLowerCase();
      const itemEmail = String(item.ownerEmail || '').trim().toLowerCase();
      if (curEmail && curEmail.includes('@') && itemEmail && curEmail === itemEmail) {
        return true;
      }
      return false;
    }

    // 1. 내 보관함에 현재 칠판/그래프 또는 N문항 통째 수업 슬라이드 저장 (로그인 회원 전용 & 본인 계정 귀속)
    async saveCurrentToMyLibrary(customTitle = null, customTags = null, customSlidesArray = null, customFolder = null) {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.promptCloudLoginForLibrary('🔒 클라우드 보관함에 업로드하려면 먼저 로그인(구글 또는 일반 ID)해 주세요.');
        return null;
      }
      const btnSave = document.getElementById('btnSaveToMyLibrary');
      const prevBtnHtml = btnSave ? btnSave.innerHTML : '<span>저장</span>';
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = `${this._getCloudVaultIconSvg('spinner')}<span>저장 중...</span>`;
      }
      try {
        if (this.isAudioRecording) {
          await this.stopAudioRecording();
        } else if (this._pendingSlideAudioFinalizers && this._pendingSlideAudioFinalizers.length > 0) {
          await Promise.all(this._pendingSlideAudioFinalizers).catch(() => { });
          this._pendingSlideAudioFinalizers = [];
        }
        const inpTitle = document.getElementById('inputCloudSaveTitle');
        const inpTags = document.getElementById('inputCloudSaveTags');

        const useCurrentOnly = (!customSlidesArray && this._cloudExplorerSaveScope === 'current');
        const activePendingFilter = (!customSlidesArray && this._pendingExportCloudFilter)
          ? { ...this._pendingExportCloudFilter }
          : null;
        const autoSlides = (!customSlidesArray)
          ? (activePendingFilter
            ? this._getFilteredSlidesForExport((inpTitle && inpTitle.value.trim()) || '수업 세팅', useCurrentOnly ? 'current' : 'all', activePendingFilter)
            : (useCurrentOnly ? [this.serializeFullSlideState('현재 캔버스')] : this._getActiveSlidesForExport()))
          : null;
        let slides = Array.isArray(customSlidesArray) && customSlidesArray.length > 0
          ? JSON.parse(JSON.stringify(customSlidesArray))
          : (autoSlides && autoSlides.length > 0 ? JSON.parse(JSON.stringify(autoSlides)) : [this.serializeFullSlideState('수업 세팅')]);

        const maxSlides = typeof this.getMaxLessonSlidesLimit === 'function' ? this.getMaxLessonSlidesLimit() : 50;
        if (Array.isArray(slides) && slides.length > maxSlides) {
          this.showToast(`⚠️ 한 수업 노트에는 최대 ${maxSlides}문항까지만 저장할 수 있습니다. (현재 ${slides.length}문항)`);
          return null;
        }

        const isDeck = Boolean(slides && slides.length > 1);
        const defaultTitle = isDeck
          ? `수업 캔버스 ${slides.length}문항 풀세트 (${new Date().toLocaleDateString('ko-KR')})`
          : `수업 세팅 (${new Date().toLocaleDateString('ko-KR')})`;

        const rawTitle = customTitle || ((inpTitle && inpTitle.value.trim()) ? inpTitle.value.trim() : defaultTitle);
        const rawTags = customTags || ((inpTags && inpTags.value.trim()) ? inpTags.value.trim() : (isDeck ? '#통째수업 #풀세트' : '#수학그래프'));
        const rawActiveFolder = (this._activeCloudFolder === '__UNCATEGORIZED__' || this._activeCloudFolder === '__ALL_RECENT__')
          ? ''
          : String(this._activeCloudFolder || '').trim();
        const folderName = customFolder !== null
          ? String(customFolder || '').trim()
          : rawActiveFolder;

        // 같은 폴더 안에 동일한 이름의 파일이 이미 있는지 먼저 확인 (덮어쓰기 / 새 이름으로 저장 / 취소)
        let finalTitle = rawTitle;
        let overwriteTargetItem = this._findDuplicateCloudItem(rawTitle, folderName);
        if (overwriteTargetItem) {
          const nextTitle = this._getNextAvailableCloudTitle(rawTitle, folderName);
          const res = await this.promptCloudDuplicateResolution(rawTitle, folderName, nextTitle, 0);
          if (!res || res.action === 'cancel') {
            return null;
          }
          if (res.action === 'rename') {
            finalTitle = nextTitle;
            overwriteTargetItem = null;
          } else if (res.action === 'overwrite') {
            finalTitle = rawTitle;
          }
        }

        // 뷰어 0.00초 즉시 오픈을 위해 스캔 이미지(viewerSnapshotDataUrl)가 없는 슬라이드는 사전 베이킹
        // (무필기 PDF 통페이지는 캔버스 재렌더링 없이 원본 PDF 이미지를 0.00초에 공유 바인딩!)
        const effFilter = activePendingFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
        await this._populateSlideViewerSnapshotsForExport(slides, effFilter, false);

        if (Array.isArray(slides)) {
          slides.forEach(s => {
            if (s && s.audioSyncData) s.audioSyncData = this._compactAudioSyncData(s.audioSyncData);
          });
        }
        const primarySlide = slides[0];
        const summaryText = isDeck
          ? `📚 ${slides.length}문항 통째 수업 · ${this._buildSlideSummaryBadge(primarySlide)}`
          : this._buildSlideSummaryBadge(primarySlide);

        const itemId = overwriteTargetItem
          ? overwriteTargetItem.id
          : ('lib_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
        const itemObj = {
          id: itemId,
          title: finalTitle,
          tags: rawTags,
          folder: folderName,
          summary: summaryText,
          isPlaylist: isDeck,
          slideCount: slides.length,
          playlistSlides: slides,
          ownerUid: this.cloudUser.uid,
          ownerEmail: this.cloudUser.email || '',
          authProvider: this.cloudUser.authProvider || 'email',
          authorName: this.cloudUser.displayName || '내 보관함',
          createdAt: Date.now(),
          slideData: null
        };

        // 6-채널 원본 볼트(cloud_share_vault) 분리 저장 & 요금제 용량 한도(Free 100MB / Pro 5GB / Premium 20GB) 사전 점검
        // 덮어쓰기 시 기존 id · 고정 vaultKeys · 발급된 공유 주소표(_shareLinksMap)를 100% 승계하여 인쇄된 교재 QR에 수정사항이 즉시 반영됨!
        const saveRes = await this._saveLibraryItemWithVaultOrFallback(itemObj, overwriteTargetItem, null, false, '클라우드 저장');
        if (!saveRes || !saveRes.ok) {
          if (!saveRes || saveRes.reason !== 'QUOTA_EXCEEDED') {
            this.showToast('⚠️ 클라우드 서버 저장에 실패했습니다. 네트워크 연결 또는 로그인 상태를 확인해 주세요.');
          }
          return null;
        }
        const savedManifestItem = saveRes.manifestItem || itemObj;

        if (overwriteTargetItem) {
          this.myLibraryCache = (this.myLibraryCache || []).filter(x => x && x.id !== itemId);
        }

        if (folderName) {
          const folders = this.getCloudFoldersList();
          const rootSeg = folderName.split('/')[0].trim();
          if (rootSeg && !folders.includes(rootSeg)) folders.push(rootSeg);
          if (!folders.includes(folderName)) folders.push(folderName);
          this._saveCloudFoldersList(folders);
        }

        this.myLibraryCache.unshift(savedManifestItem);
        this._saveMyLibraryCacheForCurrentUser();
        this._activeLoadedCloudLibraryMeta = {
          id: savedManifestItem.id,
          title: savedManifestItem.title,
          folder: savedManifestItem.folder || '',
          tags: savedManifestItem.tags || ''
        };
        if (this._selectedCloudExplorerKeys) {
          this._selectedCloudExplorerKeys.clear();
        }

        this.syncExportCloudFolderSelect();
        this.renderMyLibraryList();
        if (!customTitle && inpTitle) inpTitle.value = finalTitle;
        const folderPrefix = folderName ? `[📁 ${folderName.replace(/\//g, ' › ')}] ` : '';
        this.showToast(overwriteTargetItem
          ? `🔄 ${folderPrefix}[${finalTitle}] 파일을 최신 내용으로 덮어썼습니다!`
          : (isDeck
            ? `📚 ${folderPrefix}[${finalTitle}] (${slides.length}문항 세트) 클라우드 저장 완료!`
            : `☁️ ${folderPrefix}[${finalTitle}] 클라우드 보관함에 저장되었습니다!`));

        if (this._returnToShareModalAfterCloudSave) {
          this._returnToShareModalAfterCloudSave = false;
          this._pendingExportCloudFilter = null;
          const modalCloud = document.getElementById('modalCloudHub');
          if (modalCloud) modalCloud.classList.remove('show');
          const modalShare = document.getElementById('modalShare');
          if (modalShare) modalShare.classList.add('show');
          const btnShareToLib = document.getElementById('btnShareModalToLibrary');
          const lblShareToLib = document.getElementById('lblShareModalToLibrary');
          if (typeof this.triggerExportBtnSuccess === 'function' && btnShareToLib) {
            this.triggerExportBtnSuccess(btnShareToLib, lblShareToLib || btnShareToLib, '클라우드 저장 완료', '클라우드에 저장');
          }
        }

        return savedManifestItem;
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = prevBtnHtml;
        }
        this.renderMyLibraryList();
      }
    }

    // 보관함 항목을 불러올 때 먼저 표준 뷰어로 연결 (뷰어에서 [편집] 클릭 시 그래플리 작업 화면으로 전환!)
    async loadCloudItemToWorkspace(item, closeModal = true, openInViewer = true) {
      if (!item) return;
      this._returnToShareModalAfterCloudSave = false;
      this._pendingExportCloudFilter = null;
      const resolved = await this._resolveChunkedItem(item);
      const slides = Array.isArray(resolved.playlistSlides) && resolved.playlistSlides.length > 0
        ? resolved.playlistSlides
        : (resolved.slideData ? [resolved.slideData] : []);

      if (!slides.length) {
        this.showToast('⚠️ 불러올 캔버스 데이터가 없습니다.');
        return;
      }

      this._activeLoadedCloudLibraryMeta = {
        id: String(resolved.id || item.id || ''),
        title: String(resolved.title || item.title || '').trim(),
        folder: String(resolved.folder !== undefined ? resolved.folder : (item.folder || '')).trim(),
        tags: String(resolved.tags || item.tags || '').trim()
      };

      const hasPageSlides = slides.some(s => Boolean(s && s.pdfPageBoardData));
      this.setLessonTeachingMode(hasPageSlides ? 'page' : 'crop');
      if (slides.length > 1 || resolved.isPlaylist) {
        this.startLessonPlaylist(slides, 0);
        this.showToast(`🎯 [${resolved.title}] (${slides.length}문항 통째 수업) 시작! 1번부터 넘기며 그래프를 조작해 보세요.`);
      } else {
        this.lessonPlaylistSlides = JSON.parse(JSON.stringify(slides));
        this.lessonPlaylistIndex = 0;
        this.isLessonPlaylistActive = true;
        this.deserializeFullSlideState(slides[0]);
        this.syncLessonPlaylistNavBarUI();
        this.showToast(`⚡ [${resolved.title}] 세팅을 내 캔버스으로 가져왔습니다!`);
      }

      if (closeModal) {
        const modalCloud = document.getElementById('modalCloudHub');
        if (modalCloud) modalCloud.classList.remove('show');
      }

      if (openInViewer) {
        const previewSlides = JSON.parse(JSON.stringify(slides));
        const normalizedPkg = {
          ...resolved,
          playlistSlides: previewSlides,
          isPlaylist: previewSlides.length > 1 || Boolean(resolved.isPlaylist),
          currentIndex: 0
        };
        this._initialSharedCloudPkg = JSON.parse(JSON.stringify(normalizedPkg));
        await this.openSmartNoteViewer(normalizedPkg);
      }
    }

    // ============================================================================
    // 💾 [내 드라이브(구글 드라이브/PC/아이패드) .graphly 수업 세트 파일 저장 & 불러오기]
    // ============================================================================
    _isGraphlyFileName(name) {
      if (!name || typeof name !== 'string') return false;
      return /\.graphly$/i.test(name.trim());
    }

    _isMobileOrTabletFilePickerEnv() {
      if (typeof navigator === 'undefined') return false;
      const ua = navigator.userAgent || '';
      if (/iPad|iPhone|iPod|Android/i.test(ua)) return true;
      if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
      return false;
    }

    // iPadOS Safari / Android 파일 선택창에서 커스텀 확장자(.graphly)가 회색(비활성)으로 잠기는 OS 이슈 방어
    _syncGraphlyFileInputAcceptForDevice(inputEl, desktopAccept) {
      if (!inputEl) return;
      if (this._isMobileOrTabletFilePickerEnv()) {
        inputEl.removeAttribute('accept');
      } else if (desktopAccept) {
        inputEl.setAttribute('accept', desktopAccept);
      }
    }

    async _buildGraphlyDeckPayload(packObj) {
      const rawJsonStr = this._stringifyWithDeduplicatedSnapshots(packObj);
      return await this._compressJsonStringGzipBase64(rawJsonStr);
    }

    async _extractGraphlyPackFromText(text) {
      if (!text || typeof text !== 'string') return null;
      const trimmed = text.trim();
      if (trimmed.startsWith('{')) {
        return this._restoreDeduplicatedSlideSnapshots(JSON.parse(trimmed));
      }
      if (trimmed.startsWith('GZ1:')) {
        const jsonStr = await this._decompressJsonStringGzipBase64(trimmed);
        return this._restoreDeduplicatedSlideSnapshots(JSON.parse(jsonStr));
      }
      const fallbackStr = await this._decompressJsonStringGzipBase64(trimmed);
      return this._restoreDeduplicatedSlideSnapshots(JSON.parse(fallbackStr));
    }

    loadGraphlyPackObject(pack, fallbackTitle = '불러온 수업 세트', autoPlayIfAudio = false) {
      if (!pack) return null;
      this._restoreDeduplicatedSlideSnapshots(pack);
      let slides = Array.isArray(pack.playlistSlides) && pack.playlistSlides.length > 0
        ? pack.playlistSlides
        : (pack.slideData ? [pack.slideData] : (pack.historyJson ? [pack] : []));
      if (!slides.length) {
        this.showToast('⚠️ 올바른 Graphly 수업 파일이 아닙니다.');
        return null;
      }
      this._activeLoadedCloudLibraryMeta = null;
      const maxSlides = typeof this.getMaxLessonSlidesLimit === 'function' ? this.getMaxLessonSlidesLimit() : 50;
      if (slides.length > maxSlides) {
        this.showToast(`⚠️ 한 수업 노트는 최대 ${maxSlides}문항까지 지원되어 앞 ${maxSlides}문항만 불러왔습니다. (원본 ${slides.length}문항)`);
        slides = slides.slice(0, maxSlides);
      }
      const hasPageSlides = slides.some(s => Boolean(s && s.pdfPageBoardData));
      this.setLessonTeachingMode(hasPageSlides ? 'page' : 'crop');
      if (slides.length > 1 || pack.isPlaylist) {
        this.startLessonPlaylist(slides, 0);
      } else {
        this.lessonPlaylistSlides = JSON.parse(JSON.stringify(slides));
        this.lessonPlaylistIndex = 0;
        this.isLessonPlaylistActive = true;
        this.deserializeFullSlideState(slides[0]);
        this.syncLessonPlaylistNavBarUI();
      }
      const modalCloud = document.getElementById('modalCloudHub');
      if (modalCloud) modalCloud.classList.remove('show');

      const normalizedPkg = {
        ...pack,
        playlistSlides: slides,
        isPlaylist: slides.length > 1 || Boolean(pack.isPlaylist),
        currentIndex: 0
      };
      this._initialSharedCloudPkg = JSON.parse(JSON.stringify(normalizedPkg));
      this.exitStudentAudioVideoOnlyMode();
      this.openSmartNoteViewer(normalizedPkg);
      return pack;
    }

    async exportGraphlyDeckFile(title = 'Graphly_수업세트', tags = '#통째수업', slidesArray = null, filterOverride = null) {
      if (!slidesArray) {
        if (this.isAudioRecording) {
          await this.stopAudioRecording();
        } else if (this._pendingSlideAudioFinalizers && this._pendingSlideAudioFinalizers.length > 0) {
          await Promise.all(this._pendingSlideAudioFinalizers).catch(() => { });
          this._pendingSlideAudioFinalizers = [];
        }
      }
      let slides = slidesArray;
      if (!Array.isArray(slides) || !slides.length) {
        if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
          this.saveCurrentSlideIntoPlaylist();
          slides = JSON.parse(JSON.stringify(this.lessonPlaylistSlides));
        } else {
          slides = [this.serializeFullSlideState(title)];
        }
      }
      const effFilter = filterOverride || this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      await this._populateSlideViewerSnapshotsForExport(slides, effFilter, false);
      slides.forEach(s => {
        if (s && s.audioSyncData) {
          s.audioSyncData = this._compactAudioSyncData(s.audioSyncData);
        }
      });
      const isDeck = slides.length > 1;
      const packObj = {
        format: 'GraphlyLessonPack',
        version: '2.0',
        title: title || (isDeck ? `Graphly_${slides.length}문항_수업세트` : 'Graphly_수업노트'),
        tags: tags || '#수학그래프',
        summary: isDeck
          ? `📚 ${slides.length}문항 통째 수업 · ${this._buildSlideSummaryBadge(slides[0])}`
          : this._buildSlideSummaryBadge(slides[0]),
        createdAt: Date.now(),
        isPlaylist: isDeck,
        slideCount: slides.length,
        playlistSlides: slides,
        slideData: null
      };

      const payloadStr = await this._buildGraphlyDeckPayload(packObj);
      const blob = new Blob([payloadStr], { type: 'application/octet-stream' });
      const safeFileName = String(packObj.title)
        .replace(/[\s.]+$/, '')
        .replace(/\.graphly(\.html)?$/i, '')
        .replace(/[\\/:*?"<>|\r\n]+/g, '_')
        .replace(/[\s.]+$/, '')
        .trim() || 'Graphly_Lesson';
      const fileName = `${safeFileName}.graphly`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      this.showToast(`💾 [${fileName}] 저장 완료!`);
      return packObj;
    }

    async importGraphlyDeckFile(file) {
      if (!file) return null;
      if (!this._isGraphlyFileName(file.name)) {
        this.showToast('⚠️ Graphly 파일(.graphly)만 열 수 있습니다.');
        return null;
      }
      try {
        const text = await file.text();
        const pack = await this._extractGraphlyPackFromText(text);
        const cleanName = file.name ? file.name.trim().replace(/\.graphly$/i, '').trim() : '불러온 수업 세트';
        return this.loadGraphlyPackObject(pack, cleanName, false);
      } catch (err) {
        this.showToast('⚠️ 파일을 읽는 중 오류가 발생했습니다.');
        return null;
      }
    }

    // 내 기기(PC/아이패드)에 있는 .graphly 파일을 현재 칠판을 덮어쓰지 않고 클라우드 보관함(지정 폴더)으로 직행 업로드
    async uploadLocalGraphlyFilesToCloud(fileList, targetFolder = null) {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.promptCloudLoginForLibrary('🔒 내 기기의 파일을 클라우드 보관함에 올리려면 먼저 로그인해 주세요.');
        return [];
      }
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length) return [];

      const rawDest = (targetFolder !== null && targetFolder !== undefined)
        ? String(targetFolder).trim()
        : String(this._activeCloudFolder || '').trim();
      const destFolder = (rawDest === '__ALL_RECENT__' || rawDest === '__UNCATEGORIZED__') ? '' : rawDest;

      const maxSlides = typeof this.getMaxLessonSlidesLimit === 'function' ? this.getMaxLessonSlidesLimit() : 50;
      const parsedCandidates = [];
      let skippedOverSlideLimit = 0;
      let skippedInvalidExt = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!this._isGraphlyFileName(file.name)) {
          skippedInvalidExt++;
          continue;
        }
        try {
          const text = await file.text();
          const pack = await this._extractGraphlyPackFromText(text);
          if (!pack) continue;
          const slides = Array.isArray(pack.playlistSlides) && pack.playlistSlides.length > 0
            ? pack.playlistSlides
            : (pack.slideData ? [pack.slideData] : (pack.historyJson ? [pack] : []));
          if (!slides.length) continue;

          const cleanFileName = file.name
            ? file.name.trim().replace(/\.graphly$/i, '').trim()
            : '';
          const rawTitle = cleanFileName || (pack.title ? String(pack.title).trim() : 'Graphly 수업 노트');
          if (slides.length > maxSlides) {
            skippedOverSlideLimit++;
            this.showToast(`⚠️ [${rawTitle}] 파일은 최대 문항 수(${maxSlides}문항)를 초과하여 제외되었습니다. (${slides.length}문항)`);
            continue;
          }

          slides.forEach(s => {
            if (s && s.audioSyncData) s.audioSyncData = this._compactAudioSyncData(s.audioSyncData);
          });

          const isDeck = slides.length > 1 || Boolean(pack.isPlaylist);
          const rawTags = (pack.tags && String(pack.tags).trim()) || (isDeck ? '#통째수업' : '#수업노트');
          const primarySlide = slides[0];
          const summaryText = pack.summary || (isDeck
            ? `📚 ${slides.length}문항 통째 수업 · ${this._buildSlideSummaryBadge(primarySlide)}`
            : this._buildSlideSummaryBadge(primarySlide));

          parsedCandidates.push({
            rawTitle,
            rawTags,
            summaryText,
            isDeck,
            slides
          });
        } catch (err) { }
      }

      if (!parsedCandidates.length) {
        if (!skippedOverSlideLimit) {
          this.showToast(skippedInvalidExt > 0
            ? '⚠️ 클라우드 보관함에는 Graphly 파일(.graphly)만 업로드할 수 있습니다.'
            : '⚠️ 업로드할 수 있는 Graphly 수업 파일(.graphly)이 아닙니다.');
        }
        return [];
      }

      const pendingEntries = [];
      let batchAction = null;
      for (let i = 0; i < parsedCandidates.length; i++) {
        const cand = parsedCandidates[i];
        let finalTitle = cand.rawTitle;
        let overwriteTarget = this._findDuplicateCloudItem(cand.rawTitle, destFolder);

        if (overwriteTarget) {
          let remainingConflicts = 0;
          for (let j = i + 1; j < parsedCandidates.length; j++) {
            if (this._findDuplicateCloudItem(parsedCandidates[j].rawTitle, destFolder) ||
              parsedCandidates[j].rawTitle.trim().toLowerCase() === cand.rawTitle.trim().toLowerCase()) {
              remainingConflicts++;
            }
          }
          const nextTitle = this._getNextAvailableCloudTitle(cand.rawTitle, destFolder);
          let chosenAction = batchAction;
          if (!chosenAction) {
            const res = await this.promptCloudDuplicateResolution(cand.rawTitle, destFolder, nextTitle, remainingConflicts);
            chosenAction = (res && res.action) || 'cancel';
            if (res && res.applyToAll && remainingConflicts > 0) {
              batchAction = chosenAction;
            }
          }
          if (chosenAction === 'cancel') {
            continue;
          } else if (chosenAction === 'rename') {
            finalTitle = nextTitle;
            overwriteTarget = null;
          } else if (chosenAction === 'overwrite') {
            finalTitle = cand.rawTitle;
          }
        }

        const itemId = overwriteTarget
          ? overwriteTarget.id
          : ('lib_' + (Date.now() + i) + '_' + Math.random().toString(36).slice(2, 7));
        const itemObj = {
          id: itemId,
          title: finalTitle,
          tags: cand.rawTags,
          folder: destFolder,
          summary: cand.summaryText,
          isPlaylist: cand.isDeck,
          slideCount: cand.slides.length,
          playlistSlides: cand.slides,
          ownerUid: this.cloudUser.uid,
          ownerEmail: this.cloudUser.email || '',
          authProvider: this.cloudUser.authProvider || 'email',
          authorName: this.cloudUser.displayName || '내 보관함',
          createdAt: Date.now() + i,
          slideData: null
        };

        const preBundle = await this._prepareCloudVaultCompressedBundle(cand.slides, Date.now() + i);
        itemObj.rawByteSize = preBundle.totalRawByteSize;
        itemObj.byteSize = preBundle.totalByteSize;

        pendingEntries.push({ itemObj, overwriteTarget, preBundle });
      }

      if (!pendingEntries.length) {
        return [];
      }

      // 업로드 전 총 용량 사전 점검 (Free 100MB / Pro 5GB / Premium 20GB)
      let totalNewBytes = 0;
      let totalReplacingBytes = 0;
      pendingEntries.forEach(({ itemObj, overwriteTarget }) => {
        totalNewBytes += Number(itemObj.byteSize) || 0;
        if (overwriteTarget) {
          totalReplacingBytes += Number(overwriteTarget.byteSize) || Number(overwriteTarget.rawByteSize) || 0;
        }
      });
      if (!this.checkCanUploadBytesToCloud(totalNewBytes, totalReplacingBytes, '파일 업로드')) {
        return [];
      }

      const uploadedItems = [];
      for (let i = 0; i < pendingEntries.length; i++) {
        const { itemObj, overwriteTarget, preBundle } = pendingEntries[i];
        try {
          const saveRes = await this._saveLibraryItemWithVaultOrFallback(itemObj, overwriteTarget, preBundle, true, '파일 업로드');
          if (!saveRes || !saveRes.ok) continue;
          const savedManifest = saveRes.manifestItem || itemObj;
          if (overwriteTarget) {
            this.myLibraryCache = (this.myLibraryCache || []).filter(x => x && x.id !== itemObj.id);
          }
          this.myLibraryCache.unshift(savedManifest);
          uploadedItems.push(savedManifest);
        } catch (e) { }
      }

      if (!uploadedItems.length) {
        this.showToast('⚠️ 클라우드 서버 업로드에 실패했습니다. 네트워크 연결 또는 로그인 상태를 확인해 주세요.');
        return [];
      }

      if (destFolder) {
        const folders = this.getCloudFoldersList();
        const parts = destFolder.split('/').map(s => s.trim()).filter(Boolean);
        let cur = '';
        parts.forEach(seg => {
          cur = cur ? `${cur}/${seg}` : seg;
          if (!folders.includes(cur)) folders.push(cur);
        });
        this._saveCloudFoldersList(folders);
      }

      this._saveMyLibraryCacheForCurrentUser();
      if (this._selectedCloudExplorerKeys) {
        this._selectedCloudExplorerKeys.clear();
      }
      this.syncExportCloudFolderSelect();
      this.renderMyLibraryList();

      const folderPrefix = destFolder ? `[📁 ${destFolder.replace(/\//g, ' › ')}] ` : '';
      this.showToast(uploadedItems.length === 1
        ? `📤 ${folderPrefix}[${uploadedItems[0].title}] 파일을 클라우드에 올렸습니다!`
        : `📤 ${folderPrefix}총 ${uploadedItems.length}개 파일을 클라우드에 올렸습니다!`);
      return uploadedItems;
    }

    // 체크한 보관함 문항들을 하나의 N문항 풀세트로 묶어 슬라이드 배열 반환 (경량 매니페스트 항목도 자동 청크 복원)
    async _collectSelectedLibrarySlides() {
      const selectedSlides = [];
      const selectedFileIds = Array.from(this._selectedCloudExplorerKeys || [])
        .filter(k => k.startsWith('file:'))
        .map(k => k.slice(5));
      const items = selectedFileIds.length > 0
        ? selectedFileIds.map(id => (this.myLibraryCache || []).find(it => it && it.id === id)).filter(Boolean)
        : Array.from(document.querySelectorAll('#myLibraryList .cloud-item-chk:checked'))
          .map(box => this.myLibraryCache[parseInt(box.getAttribute('data-lib-idx'), 10)])
          .filter(Boolean);
      for (const rawItem of items) {
        if (!rawItem) continue;
        const item = await this._resolveChunkedItem(rawItem);
        if (Array.isArray(item.playlistSlides) && item.playlistSlides.length > 0) {
          item.playlistSlides.forEach((sl, sIdx) => {
            const cloneSlide = JSON.parse(JSON.stringify(sl));
            if (!cloneSlide.slideTitle) {
              cloneSlide.slideTitle = item.playlistSlides.length > 1 ? `${item.title || '문항'} (${sIdx + 1})` : (item.title || `문항 ${selectedSlides.length + 1}`);
            }
            selectedSlides.push(cloneSlide);
          });
        } else if (item.slideData) {
          const cloneSlide = JSON.parse(JSON.stringify(item.slideData));
          cloneSlide.slideTitle = item.title || cloneSlide.slideTitle || `문항 ${selectedSlides.length + 1}`;
          selectedSlides.push(cloneSlide);
        }
      }
      return selectedSlides;
    }

    async bundleSelectedLibraryItemsToFile() {
      const selectedSlides = await this._collectSelectedLibrarySlides();
      if (!selectedSlides.length) {
        this.showToast('⚠️ 내 드라이브 파일로 저장할 문항을 1개 이상 체크해 주세요!');
        return null;
      }
      const inpTitle = document.getElementById('inputCloudSaveTitle');
      const inpTags = document.getElementById('inputCloudSaveTags');
      const defaultTitle = selectedSlides.length > 1
        ? `Graphly_${selectedSlides.length}문항_통째수업세트`
        : (selectedSlides[0].slideTitle || 'Graphly_수업노트');
      const title = (inpTitle && inpTitle.value.trim()) ? inpTitle.value.trim() : defaultTitle;
      const tags = (inpTags && inpTags.value.trim()) ? inpTags.value.trim() : '#통째수업';
      const fullFilter = { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      return await this.exportGraphlyDeckFile(title, tags, selectedSlides, fullFilter);
    }

    async fetchMyLibraryFromCloud() {
      if (!this.cloudUser || !this.cloudUser.uid) {
        this.myLibraryCache = [];
        this.renderMyLibraryList();
        return [];
      }
      try {
        const idToken = await this._getFirebaseIdTokenForRest(true);
        if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol) && !idToken) {
          return this.myLibraryCache;
        }
        const uid = this.cloudUser.uid;
        const authCurrentUid = (this._fbAuth && this._fbAuth.currentUser && this._fbAuth.currentUser.uid)
          ? String(this._fbAuth.currentUser.uid)
          : '';
        const normEmail = String(
          (this._fbAuth && this._fbAuth.currentUser && this._fbAuth.currentUser.email) ||
          this.cloudUser.email ||
          ''
        ).trim().toLowerCase();
        const emailVariants = (normEmail && normEmail.includes('@'))
          ? [
            this._getCanonicalUidForEmail(normEmail, '', 'google'),
            this._getCanonicalUidForEmail(normEmail, '', 'email')
          ]
          : [];
        const uidVariants = authCurrentUid
          ? [
            authCurrentUid,
            'acct_' + authCurrentUid.replace(/[^a-z0-9@._-]/g, '_'),
            'id_' + authCurrentUid.replace(/[^a-z0-9@._-]/g, '_')
          ]
          : [];
        const candidateUids = Array.from(new Set([uid, ...uidVariants, ...emailVariants].filter(Boolean)));
        const folderDocId = `folders_${uid}`;
        const [remoteFolderDoc, remoteItems] = await Promise.all([
          this._firestoreRestReadDoc('user_preferences', folderDocId, true).catch(() => null),
          this._firestoreRestQueryByOwner('user_library', candidateUids, 500).catch(() => null)
        ]);

        // 1. 수업 파일 목록 및 파일별 폴더 위치(folder)·제목(title) 클라우드 최신본 우선 반영
        if (Array.isArray(remoteItems)) {
          const filtered = remoteItems.filter(it => this._isOwnedByCurrentCloudUser(it));
          const prevMap = new Map();
          (this.myLibraryCache || []).forEach(it => {
            if (it && it.id && this._isOwnedByCurrentCloudUser(it)) {
              prevMap.set(it.id, it);
            }
          });

          const mergedMap = new Map();
          filtered.forEach(remoteIt => {
            if (!remoteIt || !remoteIt.id) return;
            const prev = prevMap.get(remoteIt.id);
            if (prev && (remoteIt._isChunked || remoteIt._isVaultLayered) && !remoteIt.playlistSlides && !remoteIt.slideData) {
              const keepPrevSlides = (!remoteIt._isVaultLayered) &&
                !(Number(remoteIt.vaultUpdatedAt || 0) > Number(prev.vaultUpdatedAt || 0));
              const mergedShareLinks = (prev._shareLinksMap || remoteIt._shareLinksMap)
                ? { ...(prev._shareLinksMap || {}), ...(remoteIt._shareLinksMap || {}) }
                : undefined;
              const mergedEntry = {
                ...prev,
                ...remoteIt,
                byteSize: remoteIt.byteSize || prev.byteSize || 0,
                rawByteSize: remoteIt.rawByteSize || prev.rawByteSize || 0,
                playlistSlides: keepPrevSlides ? (prev.playlistSlides || null) : null,
                slideData: keepPrevSlides ? (prev.slideData || null) : null
              };
              if (mergedShareLinks && Object.keys(mergedShareLinks).length > 0) {
                mergedEntry._shareLinksMap = mergedShareLinks;
              }
              mergedMap.set(remoteIt.id, mergedEntry);
            } else {
              mergedMap.set(remoteIt.id, remoteIt);
            }
          });

          // 방금 현재 기기에서 생성 중이어서 아직 서버 응답에 반영 안 된 최신 항목(15초 이내)만 임시 보호
          const now = Date.now();
          prevMap.forEach((prevIt, id) => {
            if (!mergedMap.has(id) && prevIt.createdAt && (now - prevIt.createdAt < 15000)) {
              mergedMap.set(id, prevIt);
            }
          });

          this.myLibraryCache = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          this._saveMyLibraryCacheForCurrentUser();
        }

        // 2. 폴더 트리 클라우드 동기화
        if (remoteFolderDoc && Array.isArray(remoteFolderDoc.folders)) {
          this._saveCloudFoldersList(remoteFolderDoc.folders, false);
        }

        this.syncExportCloudFolderSelect();
        this.renderMyLibraryList();
      } catch (e) { }
      return this.myLibraryCache;
    }

    // ============================================================================
    // [Stitch 정밀 벡터 아이콘 시스템 & 클라우드 보관함 직접 공유 링크 발급 엔진]
    // ============================================================================
    _cleanCloudFolderDisplayLabel(rawSeg) {
      const cleaned = String(rawSeg || '').replace(/^(?:🔗|📁|📂)\s*/u, '').trim();
      return cleaned || String(rawSeg || '').trim();
    }

    _cleanCloudFolderPathLabel(rawPath) {
      return String(rawPath || '')
        .split('/')
        .map(s => this._cleanCloudFolderDisplayLabel(s))
        .filter(Boolean)
        .join(' › ');
    }

    _getCloudVaultIconSvg(name) {
      switch (name) {
        case 'cloudRoot':
          return `<svg class="cv-svg cv-svg-cloud" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
        case 'folderClosed':
          return `<svg class="cv-svg cv-svg-folder" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
        case 'folderOpen':
          return `<svg class="cv-svg cv-svg-folder is-open" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>`;
        case 'folderMini':
          return `<svg class="cv-svg cv-svg-folder-mini" width="11.5" height="11.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
        case 'allFiles':
          return `<svg class="cv-svg cv-svg-layers" width="14.5" height="14.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
        case 'graphlyFile':
          return `<span class="graphly-file-tile-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3.5 17.5C6.2 6.2 9.8 6.2 12 12C14.2 17.8 17.8 17.8 20.5 6.5" stroke="currentColor" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.9" cy="8.9" r="1.75" fill="currentColor"/></svg></span>`;
        case 'shareLink':
          return `<svg class="cv-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
        case 'shareBadgeLink':
          return `<svg class="cv-svg" width="10.5" height="10.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
        case 'renamePencil':
          return `<svg class="cv-svg" width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
        case 'check':
          return `<svg class="cv-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        case 'spinner':
          return `<svg class="cv-svg cv-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
        case 'search':
          return `<svg class="cv-svg cv-svg-search" width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
        case 'openCanvas':
          return `<svg class="cv-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
        case 'download':
          return `<svg class="cv-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
        case 'moveFolder':
          return `<svg class="cv-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/></svg>`;
        case 'trash':
          return `<svg class="cv-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
        case 'chevronUp':
          return `<svg class="cv-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`;
        case 'arrowUpRight':
          return `<svg class="cv-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
        case 'lock':
          return `<svg class="cv-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
        case 'qrCode':
          return `<svg class="cv-svg" width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v3h-2"/><path d="M14 20h3"/><path d="M19 19h2v2h-2z"/></svg>`;
        default:
          return '';
      }
    }

    _isShareLinkEntryActive(entry, nowMs = Date.now()) {
      if (!entry || !entry.shortId) return false;
      if (entry.isPermanent) return true;
      const expMs = Number(entry.expiresAt) || 0;
      return expMs <= 0 || expMs > nowMs + 60 * 1000;
    }

    _hasPermanentCloudItemShare(item) {
      if (!item) return false;
      if (item.linkedShareId) return true;
      if (item._shareLinksMap && typeof item._shareLinksMap === 'object') {
        return Object.values(item._shareLinksMap).some(ent => Boolean(ent && ent.shortId && ent.isPermanent));
      }
      return false;
    }

    _getActiveCloudItemShareId(item, filterOpts = null) {
      if (!item) return '';
      const nowMs = Date.now();
      const mapObj = (item._shareLinksMap && typeof item._shareLinksMap === 'object') ? item._shareLinksMap : null;

      if (filterOpts) {
        const sig = this._getExportFilterSignatureKey(filterOpts);
        if (mapObj && mapObj[sig] && this._isShareLinkEntryActive(mapObj[sig], nowMs)) {
          return String(mapObj[sig].shortId);
        }
        if (sig === '1111') {
          if (item.linkedShareId) return String(item.linkedShareId);
          if (item._tempShareId) {
            const expMs = Number(item._tempShareExpiresAt) || 0;
            if (expMs <= 0 || expMs > nowMs + 60 * 1000) {
              return String(item._tempShareId);
            }
          }
        }
        return '';
      }

      if (mapObj) {
        if (mapObj['1111'] && this._isShareLinkEntryActive(mapObj['1111'], nowMs)) {
          return String(mapObj['1111'].shortId);
        }
        const anyActive = Object.values(mapObj).find(ent => this._isShareLinkEntryActive(ent, nowMs));
        if (anyActive) return String(anyActive.shortId);
      }

      if (item.linkedShareId) return String(item.linkedShareId);
      if (item._tempShareId) {
        const expMs = Number(item._tempShareExpiresAt) || 0;
        if (expMs <= 0 || expMs > nowMs + 60 * 1000) {
          return String(item._tempShareId);
        }
      }
      return '';
    }

    async _copyCloudTextToClipboard(text) {
      if (!text) return false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_) { }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return Boolean(ok);
      } catch (_) {
        return false;
      }
    }

    _countActiveCloudItemShares(item) {
      if (!item) return 0;
      const nowMs = Date.now();
      const activeIds = new Set();
      if (item._shareLinksMap && typeof item._shareLinksMap === 'object') {
        Object.values(item._shareLinksMap).forEach((ent) => {
          if (this._isShareLinkEntryActive(ent, nowMs) && ent.shortId) {
            activeIds.add(String(ent.shortId));
          }
        });
      }
      if (item.linkedShareId) {
        activeIds.add(String(item.linkedShareId));
      }
      if (item._tempShareId) {
        const expMs = Number(item._tempShareExpiresAt) || 0;
        if (expMs <= 0 || expMs > nowMs + 60 * 1000) {
          activeIds.add(String(item._tempShareId));
        }
      }
      return activeIds.size;
    }

    _getCloudShareFilterStageInfo(filterOpts = null) {
      const f = filterOpts || {};
      const p = f.includeProblem !== false;
      const g = f.includeGraph !== false;
      const i = f.includeInk !== false;
      const a = f.includeAudio !== false;
      if (p && g && i && a) {
        return { summaryLabel: '전체 포함', fileSuffix: '전체' };
      }
      if (p && !g && !i && !a) {
        return { summaryLabel: '문제만', fileSuffix: '문제만' };
      }
      const parts = [];
      if (p) parts.push('문제');
      if (g) parts.push('그래프');
      if (i) parts.push('필기');
      if (a) parts.push('음성');
      const joined = parts.join('+') || '선택항목';
      return { summaryLabel: joined, fileSuffix: joined };
    }

    _downloadQrCodePngForUrl(urlStr, rawTitle = '', filterOpts = null) {
      if (!urlStr || typeof document === 'undefined') return { ok: false };
      const MQR = (typeof window !== 'undefined' && window.MiniQRCode)
        ? window.MiniQRCode
        : (typeof MiniQRCode !== 'undefined' ? MiniQRCode : null);
      if (!MQR || typeof MQR.drawToCanvas !== 'function') {
        return { ok: false };
      }
      let qrCanvas = document.getElementById('qrCanvas');
      if (!qrCanvas) {
        qrCanvas = document.createElement('canvas');
        qrCanvas.width = 240;
        qrCanvas.height = 240;
      }
      try {
        MQR.drawToCanvas(urlStr, qrCanvas, {
          size: 240,
          padding: 10,
          fgColor: '#0f172a',
          bgColor: '#ffffff'
        });
        const dataUrl = qrCanvas.toDataURL('image/png');
        const stageInfo = this._getCloudShareFilterStageInfo(filterOpts);
        const cleanBaseTitle = String(rawTitle || 'Graphly')
          .replace(/[\\/:*?"<>|\r\n]+/g, '_')
          .trim()
          .slice(0, 48) || 'Graphly';
        const fileName = `Graphly_QR_${cleanBaseTitle}_${stageInfo.fileSuffix}.png`;
        this._lastDownloadedCloudQrMeta = {
          url: urlStr,
          fileName,
          dataUrl,
          filterSig: this._getExportFilterSignatureKey(filterOpts || {}),
          createdAt: Date.now()
        };
        if (!this._suppressCloudQrBrowserDownload) {
          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return { ok: true, fileName, dataUrl };
      } catch (_) {
        return { ok: false };
      }
    }

    _flashCloudShareBtnSuccess(itemId, flashLabel = '링크 복사됨') {
      const listEl = document.getElementById('myLibraryList');
      if (!listEl || !itemId) return;
      const targetRow = listEl.querySelector(`.win-explorer-row[data-row-key="file:${CSS.escape ? CSS.escape(itemId) : itemId}"]`);
      if (!targetRow) return;
      const btn = targetRow.querySelector('.btn-cloud-share-item');
      const badge = targetRow.querySelector('.cloud-perm-link-badge');
      const cacheTarget = (this.myLibraryCache || []).find(x => x && x.id === itemId) || null;
      const activeCnt = cacheTarget ? this._countActiveCloudItemShares(cacheTarget) : 1;
      const restBadgeText = activeCnt > 1 ? `공유 링크 ${activeCnt}` : '공유 링크';
      if (btn) {
        btn.classList.add('is-copied-flash');
        btn.innerHTML = this._getCloudVaultIconSvg('check');
      }
      if (badge) {
        badge.classList.add('is-copied-flash');
        badge.innerHTML = `${this._getCloudVaultIconSvg('check')}<span>${this._escapeHtmlStr(flashLabel)}</span>`;
      }
      setTimeout(() => {
        if (btn && btn.isConnected) {
          btn.classList.remove('is-copied-flash');
          btn.innerHTML = this._getCloudVaultIconSvg('shareLink');
        }
        if (badge && badge.isConnected) {
          badge.classList.remove('is-copied-flash');
          const refreshedItem = (this.myLibraryCache || []).find(x => x && x.id === itemId) || cacheTarget;
          const refreshedCnt = refreshedItem ? this._countActiveCloudItemShares(refreshedItem) : activeCnt;
          const nextTxt = refreshedCnt > 1 ? `공유 링크 ${refreshedCnt}` : restBadgeText;
          badge.innerHTML = `${this._getCloudVaultIconSvg('shareBadgeLink')}<span>${nextTxt}</span>`;
        }
      }, 1600);
    }

    initCloudShareOptionPopoverEvents() {
      if (this._cloudShareOptionPopoverBound) return;
      this._cloudShareOptionPopoverBound = true;

      this._cloudSharePopoverFilter = {
        includeProblem: true,
        includeGraph: true,
        includeInk: true,
        includeAudio: true
      };
      this._activeCloudSharePopoverItemId = '';
      this._activeCloudSharePopoverItemRef = null;
      this._activeCloudSharePopoverAnchorBtn = null;

      const popEl = document.getElementById('cloudShareOptionPopover');
      const btnClose = document.getElementById('btnCloseCloudSharePop');
      const chkProblem = document.getElementById('chkCloudShareOptProblem');
      const chkGraph = document.getElementById('chkCloudShareOptGraph');
      const chkInk = document.getElementById('chkCloudShareOptInk');
      const chkAudio = document.getElementById('chkCloudShareOptAudio');
      const btnCopy = document.getElementById('btnCloudSharePopCopyLink');
      const lblCopy = document.getElementById('lblBtnCloudSharePopCopy');
      const btnQr = document.getElementById('btnCloudSharePopSaveQr');
      const lblQr = document.getElementById('lblBtnCloudSharePopQr');
      const listEl = document.getElementById('myLibraryList');

      if (btnClose) {
        btnClose.onclick = (e) => {
          if (e) e.stopPropagation();
          this.closeCloudItemSharePopover();
        };
      }

      const onOptToggle = (key, chkEl) => {
        if (!chkEl) return;
        if (!this._cloudSharePopoverFilter) {
          this._cloudSharePopoverFilter = { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
        }
        this._cloudSharePopoverFilter[key] = Boolean(chkEl.checked);
        const f = this._cloudSharePopoverFilter;
        if (!f.includeProblem && !f.includeGraph && !f.includeInk && !f.includeAudio) {
          this._cloudSharePopoverFilter[key] = true;
          chkEl.checked = true;
          this.showToast('공유에 포함할 항목을 최소 1개 이상 선택해 주세요.');
        }
        this._syncCloudShareOptionPopoverUI();
      };

      if (chkProblem) chkProblem.onchange = () => onOptToggle('includeProblem', chkProblem);
      if (chkGraph) chkGraph.onchange = () => onOptToggle('includeGraph', chkGraph);
      if (chkInk) chkInk.onchange = () => onOptToggle('includeInk', chkInk);
      if (chkAudio) chkAudio.onchange = () => onOptToggle('includeAudio', chkAudio);

      const flashPopBtn = (btnEl, lblEl, tempText, origText) => {
        if (!btnEl || !lblEl) return;
        if (btnEl._popFlashTimer) {
          clearTimeout(btnEl._popFlashTimer);
          btnEl._popFlashTimer = null;
        }
        btnEl.classList.add('is-success-flash');
        lblEl.textContent = tempText;
        btnEl._popFlashTimer = setTimeout(() => {
          btnEl.classList.remove('is-success-flash');
          lblEl.textContent = origText;
          btnEl._popFlashTimer = null;
        }, 1500);
      };

      const runPopoverAction = async (mode) => {
        const targetId = this._activeCloudSharePopoverItemId;
        if (!targetId) return;
        const targetItem = (this.myLibraryCache || []).find(x => x && x.id === targetId) || this._activeCloudSharePopoverItemRef;
        if (!targetItem) return;

        const isQr = (mode === 'qr');
        const activeBtn = isQr ? btnQr : btnCopy;
        const activeLbl = isQr ? lblQr : lblCopy;
        const origText = isQr ? 'QR 저장' : '링크 복사';
        const hasExisting = Boolean(this._getActiveCloudItemShareId(targetItem, this._cloudSharePopoverFilter));

        if (btnCopy) btnCopy.disabled = true;
        if (btnQr) btnQr.disabled = true;
        if (!hasExisting && activeLbl) {
          activeLbl.textContent = isQr ? 'QR 생성 중...' : '링크 생성 중...';
        }

        try {
          const liveRowBtn = this._findCloudRowShareBtn(targetId) || this._activeCloudSharePopoverAnchorBtn;
          const shareUrl = await this.shareCloudLibraryItemDirect(
            targetItem,
            liveRowBtn,
            { ...this._cloudSharePopoverFilter },
            { copyClipboard: !isQr, downloadQr: isQr }
          );
          if (shareUrl) {
            flashPopBtn(activeBtn, activeLbl, isQr ? 'QR 저장됨' : '복사 완료', origText);
          } else if (activeLbl) {
            activeLbl.textContent = origText;
          }
        } finally {
          if (btnCopy) btnCopy.disabled = false;
          if (btnQr) btnQr.disabled = false;
          this._syncCloudShareOptionPopoverUI();
          this._positionCloudShareOptionPopover();
        }
      };

      if (btnCopy) {
        btnCopy.onclick = (e) => {
          if (e) e.stopPropagation();
          runPopoverAction('copy');
        };
      }
      if (btnQr) {
        btnQr.onclick = (e) => {
          if (e) e.stopPropagation();
          runPopoverAction('qr');
        };
      }

      if (listEl) {
        listEl.addEventListener('scroll', () => {
          if (this._activeCloudSharePopoverItemId) {
            this.closeCloudItemSharePopover();
          }
        }, { passive: true });
      }

      window.addEventListener('resize', () => {
        if (this._activeCloudSharePopoverItemId) {
          this._positionCloudShareOptionPopover();
        }
      }, { passive: true });

      window.addEventListener('pointerdown', (e) => {
        if (!this._activeCloudSharePopoverItemId || !popEl || popEl.style.display === 'none') return;
        const t = e.target;
        if (t && popEl.contains(t)) return;
        if (t && t.closest && (t.closest('.btn-cloud-share-item') || t.closest('.cloud-perm-link-badge'))) return;
        this.closeCloudItemSharePopover();
      }, { capture: true });

      window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!this._activeCloudSharePopoverItemId || !popEl || popEl.style.display === 'none') return;
        e.preventDefault();
        e.stopPropagation();
        this.closeCloudItemSharePopover();
      }, { capture: true });
    }

    _findCloudRowShareBtn(itemId) {
      const listEl = document.getElementById('myLibraryList');
      if (!listEl || !itemId) return null;
      const escapedId = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(itemId) : itemId;
      const row = listEl.querySelector(`.win-explorer-row[data-row-key="file:${escapedId}"]`);
      return row ? row.querySelector('.btn-cloud-share-item') : null;
    }

    openCloudItemSharePopover(item, anchorBtnEl = null) {
      if (!item || !item.id) return;
      const popEl = document.getElementById('cloudShareOptionPopover');
      if (!popEl) {
        this.shareCloudLibraryItemDirect(item, anchorBtnEl);
        return;
      }

      // 동일 파일의 [🔗] 버튼을 다시 누르면 깔끔하게 토글 닫기
      if (this._activeCloudSharePopoverItemId === item.id && popEl.style.display !== 'none') {
        this.closeCloudItemSharePopover();
        return;
      }

      // 이전 열린 버튼 하이라이트 정리
      document.querySelectorAll('#myLibraryList .btn-cloud-share-item.is-popover-open').forEach((b) => {
        b.classList.remove('is-popover-open');
      });

      // ★ 열 때마다 항상 [문제 · 그래프 · 필기 · 음성] 4개 항목 전체 체크 상태로 초기화!
      this._cloudSharePopoverFilter = {
        includeProblem: true,
        includeGraph: true,
        includeInk: true,
        includeAudio: true
      };
      this._activeCloudSharePopoverItemId = item.id;
      this._activeCloudSharePopoverItemRef = item;
      this._activeCloudSharePopoverAnchorBtn = anchorBtnEl || this._findCloudRowShareBtn(item.id);

      const btnCopy = document.getElementById('btnCloudSharePopCopyLink');
      const lblCopy = document.getElementById('lblBtnCloudSharePopCopy');
      const btnQr = document.getElementById('btnCloudSharePopSaveQr');
      const lblQr = document.getElementById('lblBtnCloudSharePopQr');
      [
        [btnCopy, lblCopy, '링크 복사'],
        [btnQr, lblQr, 'QR 저장']
      ].forEach(([b, l, txt]) => {
        if (b && b._popFlashTimer) {
          clearTimeout(b._popFlashTimer);
          b._popFlashTimer = null;
        }
        if (b) {
          b.disabled = false;
          b.classList.remove('is-success-flash');
        }
        if (l) l.textContent = txt;
      });

      if (this._activeCloudSharePopoverAnchorBtn) {
        this._activeCloudSharePopoverAnchorBtn.classList.add('is-popover-open');
      }

      this._syncCloudShareOptionPopoverUI();
      popEl.style.display = 'block';
      this._positionCloudShareOptionPopover();
    }

    closeCloudItemSharePopover() {
      const popEl = document.getElementById('cloudShareOptionPopover');
      if (popEl) {
        popEl.style.display = 'none';
      }
      document.querySelectorAll('#myLibraryList .btn-cloud-share-item.is-popover-open').forEach((b) => {
        b.classList.remove('is-popover-open');
      });
      this._activeCloudSharePopoverItemId = '';
      this._activeCloudSharePopoverItemRef = null;
      this._activeCloudSharePopoverAnchorBtn = null;
    }

    _positionCloudShareOptionPopover() {
      const popEl = document.getElementById('cloudShareOptionPopover');
      if (!popEl || popEl.style.display === 'none' || !this._activeCloudSharePopoverItemId) return;
      let anchorBtn = this._activeCloudSharePopoverAnchorBtn;
      if (!anchorBtn || !anchorBtn.isConnected) {
        anchorBtn = this._findCloudRowShareBtn(this._activeCloudSharePopoverItemId);
        this._activeCloudSharePopoverAnchorBtn = anchorBtn;
      }
      if (!anchorBtn) {
        this.closeCloudItemSharePopover();
        return;
      }
      anchorBtn.classList.add('is-popover-open');

      const btnRect = anchorBtn.getBoundingClientRect();
      if (btnRect.width <= 0 && btnRect.height <= 0) {
        this.closeCloudItemSharePopover();
        return;
      }

      const popW = popEl.offsetWidth || 268;
      const popH = popEl.offsetHeight || 168;
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;

      let left = Math.round(btnRect.right - popW);
      if (left + popW > vw - 12) left = vw - popW - 12;
      if (left < 12) left = 12;

      let top = Math.round(btnRect.bottom + 6);
      if (top + popH > vh - 14 && btnRect.top - popH - 6 >= 12) {
        top = Math.round(btnRect.top - popH - 6);
      } else if (top + popH > vh - 10) {
        top = Math.max(12, vh - popH - 10);
      }

      popEl.style.left = `${left}px`;
      popEl.style.top = `${top}px`;
    }

    _syncCloudShareOptionPopoverUI() {
      const popEl = document.getElementById('cloudShareOptionPopover');
      if (!popEl || !this._activeCloudSharePopoverItemId) return;
      const item = (this.myLibraryCache || []).find(x => x && x.id === this._activeCloudSharePopoverItemId) || this._activeCloudSharePopoverItemRef;
      if (!item) return;

      const f = this._cloudSharePopoverFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      const lblTitle = document.getElementById('lblCloudSharePopTitle');
      const lblFilterTag = document.getElementById('lblCloudSharePopFilterSummary');
      const lblStatus = document.getElementById('lblCloudSharePopStatus');
      const chkProblem = document.getElementById('chkCloudShareOptProblem');
      const chkGraph = document.getElementById('chkCloudShareOptGraph');
      const chkInk = document.getElementById('chkCloudShareOptInk');
      const chkAudio = document.getElementById('chkCloudShareOptAudio');
      const lblProblem = document.getElementById('lblCloudShareOptProblem');
      const lblGraph = document.getElementById('lblCloudShareOptGraph');
      const lblInk = document.getElementById('lblCloudShareOptInk');
      const lblAudio = document.getElementById('lblCloudShareOptAudio');

      if (lblTitle) {
        lblTitle.textContent = item.title || '수업 노트 공유';
        lblTitle.title = item.title || '';
      }

      const incP = f.includeProblem !== false;
      const incG = f.includeGraph !== false;
      const incI = f.includeInk !== false;
      const incA = f.includeAudio !== false;
      if (chkProblem) chkProblem.checked = incP;
      if (chkGraph) chkGraph.checked = incG;
      if (chkInk) chkInk.checked = incI;
      if (chkAudio) chkAudio.checked = incA;
      if (lblProblem) lblProblem.classList.toggle('active', incP);
      if (lblGraph) lblGraph.classList.toggle('active', incG);
      if (lblInk) lblInk.classList.toggle('active', incI);
      if (lblAudio) lblAudio.classList.toggle('active', incA);

      const stageInfo = this._getCloudShareFilterStageInfo(f);
      if (lblFilterTag) {
        lblFilterTag.textContent = stageInfo.summaryLabel;
        lblFilterTag.classList.toggle('is-partial', stageInfo.summaryLabel !== '전체 포함');
      }

      if (lblStatus) {
        const sig = this._getExportFilterSignatureKey(f);
        const existingId = this._getActiveCloudItemShareId(item, f);
        if (existingId) {
          const mapEntry = (item._shareLinksMap && item._shareLinksMap[sig]) || null;
          const isPermExisting = Boolean((mapEntry && mapEntry.isPermanent) || (sig === '1111' && item.linkedShareId));
          if (isPermExisting) {
            lblStatus.className = 'cloud-share-pop-status is-active-perm';
            lblStatus.innerHTML = `<span class="pop-status-dot"></span><span>발급된 영구 링크 활성 · 수정사항 자동 반영</span>`;
          } else {
            const expMs = Number((mapEntry && mapEntry.expiresAt) || (sig === '1111' ? item._tempShareExpiresAt : 0)) || 0;
            const remDays = expMs > Date.now()
              ? Math.max(1, Math.ceil((expMs - Date.now()) / (24 * 60 * 60 * 1000)))
              : (Number(mapEntry && mapEntry.shareExpiryDays) || 7);
            lblStatus.className = 'cloud-share-pop-status is-active';
            lblStatus.innerHTML = `<span class="pop-status-dot"></span><span>발급된 링크 활성(${remDays}일 남음) · 수정 자동 반영</span>`;
          }
        } else {
          const quota = typeof this.getCurrentTierQuota === 'function' ? this.getCurrentTierQuota() : null;
          const tier = (this.cloudUser && this.cloudUser.uid && typeof this.getUserSubscriptionTier === 'function')
            ? this.getUserSubscriptionTier()
            : 'free';
          if (tier === 'premium') {
            lblStatus.className = 'cloud-share-pop-status is-new-perm';
            lblStatus.innerHTML = `<span class="pop-status-dot"></span><span>영구 링크 발급 · 덮어쓰기 시 기존 QR 자동 반영</span>`;
          } else if (tier === 'pro') {
            const days = (quota && Number(quota.shareExpiryDays) > 0) ? Number(quota.shareExpiryDays) : 7;
            lblStatus.className = 'cloud-share-pop-status';
            lblStatus.innerHTML = `<span class="pop-status-dot"></span><span>${days}일 유효 링크 · 덮어쓰기 시 QR 자동 반영</span>`;
          } else {
            const days = (quota && Number(quota.shareExpiryDays) > 0) ? Number(quota.shareExpiryDays) : 3;
            const usage = typeof this.getShareDailyUsageStatus === 'function' ? this.getShareDailyUsageStatus() : null;
            const limit = (usage && usage.dailyLimit) ? usage.dailyLimit : 5;
            const rem = (usage && typeof usage.remainingCount === 'number') ? usage.remainingCount : limit;
            lblStatus.className = 'cloud-share-pop-status';
            lblStatus.innerHTML = `<span class="pop-status-dot"></span><span>${days}일 유효 · 오늘 ${rem}/${limit}회 남음 · 수정 자동 반영</span>`;
          }
        }
      }
    }

    // 클라우드 보관함 리스트에서 현재 작업 칠판을 건드리지 않고 원클릭으로 즉시 초경량 주소표(Vault Pointer) 공유 링크 생성 & 복사 / QR 저장!
    // (사본 추가 0바이트 · 선택된 레이어 키만 노출되어 정답 유출 원천 차단 · 덮어쓰기 시 기존 QR 실시간 반영!)
    async shareCloudLibraryItemDirect(item, triggerBtnEl = null, customFilterOpts = null, actionOpts = null) {
      if (!item || !item.id) return null;
      const effFilter = customFilterOpts
        ? {
          includeProblem: customFilterOpts.includeProblem !== false,
          includeGraph: customFilterOpts.includeGraph !== false,
          includeInk: customFilterOpts.includeInk !== false,
          includeAudio: customFilterOpts.includeAudio !== false
        }
        : { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };

      if (!effFilter.includeProblem && !effFilter.includeGraph && !effFilter.includeInk && !effFilter.includeAudio) {
        this.showToast('⚠️ 공유에 포함할 항목(문제·그래프·필기·음성)을 최소 1개 이상 선택해 주세요.');
        return null;
      }

      const wantQr = Boolean(actionOpts && actionOpts.downloadQr);
      const wantCopy = (actionOpts && actionOpts.copyClipboard !== undefined)
        ? Boolean(actionOpts.copyClipboard)
        : !wantQr;
      const stageInfo = this._getCloudShareFilterStageInfo(effFilter);
      const stageToastPrefix = (stageInfo.summaryLabel !== '전체 포함') ? `[${stageInfo.summaryLabel}] ` : '';

      const filterSig = this._getExportFilterSignatureKey(effFilter);
      const base = (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol))
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://graphly.net/';

      let cacheTarget = (this.myLibraryCache || []).find(x => x && x.id === item.id) || item;

      // 1) 동일 옵션(filterSig)에 대해 이미 유효한 영구 링크 또는 만료 전 공유 링크가 있으면 0.00초 즉시 재복사·QR저장 (서버 호출·차감 0!)
      const existingShareId = this._getActiveCloudItemShareId(cacheTarget, effFilter);
      if (existingShareId) {
        const shareUrl = `${base}#cloud=${existingShareId}`;
        const mapEntry = (cacheTarget._shareLinksMap && cacheTarget._shareLinksMap[filterSig]) || null;
        const isPermExisting = Boolean((mapEntry && mapEntry.isPermanent) || (filterSig === '1111' && cacheTarget.linkedShareId));
        if (wantQr) {
          this._downloadQrCodePngForUrl(shareUrl, cacheTarget.title || item.title, effFilter);
          this._flashCloudShareBtnSuccess(item.id, 'QR 저장됨');
          this.showToast(isPermExisting
            ? `${stageToastPrefix}영구 QR 코드 이미지가 저장되었습니다!`
            : `${stageToastPrefix}QR 코드 이미지가 저장되었습니다!`);
        }
        if (wantCopy) {
          const copied = await this._copyCloudTextToClipboard(shareUrl);
          this._flashCloudShareBtnSuccess(item.id, '링크 복사됨');
          this.showToast(copied
            ? (isPermExisting ? `${stageToastPrefix}영구 공유 링크가 클립보드에 복사되었습니다!` : `${stageToastPrefix}공유 링크가 클립보드에 복사되었습니다!`)
            : `${stageToastPrefix}공유 링크: ${shareUrl}`);
        }
        return shareUrl;
      }

      // 중복 클릭 가드
      if (!this._creatingDirectCloudShareIds) {
        this._creatingDirectCloudShareIds = new Set();
      }
      const lockKey = `${item.id}:${filterSig}`;
      if (this._creatingDirectCloudShareIds.has(lockKey)) return null;

      // 2) 일일 무료 공유 티켓(Free 일일 5회 / Pro·Premium 무제한) 및 분당 매크로 버스트 사전 점검
      const preUsage = this.getShareDailyUsageStatus();
      if (preUsage.dailyLimit > 0 && preUsage.remainingCount <= 0) {
        this._handleShareDailyLimitExceeded(preUsage.isGuest);
        return null;
      }
      if (typeof this._checkClientShareBurstGuard === 'function' && !this._checkClientShareBurstGuard()) {
        return null;
      }

      this._creatingDirectCloudShareIds.add(lockKey);
      if (triggerBtnEl) {
        triggerBtnEl.disabled = true;
        triggerBtnEl.classList.add('is-loading');
        triggerBtnEl.innerHTML = this._getCloudVaultIconSvg('spinner');
      }

      try {
        this._purgeExpiredSharedWorkspaces().catch(() => { });

        const maxSlides = typeof this.getMaxLessonSlidesLimit === 'function' ? this.getMaxLessonSlidesLimit() : 50;
        let hasVaultKeys = Boolean(cacheTarget._isVaultLayered && cacheTarget.vaultKeys && cacheTarget.vaultKeys.skeletonKey);
        let fallbackResolvedSlides = null;

        // 3) 구버전 클라우드 파일이면 최초 1회만 백그라운드에서 6-채널 원본 볼트(cloud_share_vault)로 자동 전환!
        //    (신규 저장·덮어쓰기 파일은 이미 볼트 키를 보유하므로 슬라이드 다운로드 0바이트로 즉시 주소표만 발급!)
        if (!hasVaultKeys) {
          const resolved = await this._resolveChunkedItem(cacheTarget);
          const fullFilter = { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
          const rawSlides = (Array.isArray(resolved.playlistSlides) && resolved.playlistSlides.length > 0)
            ? JSON.parse(JSON.stringify(resolved.playlistSlides))
            : (resolved.slideData ? [JSON.parse(JSON.stringify(resolved.slideData))] : []);

          if (!rawSlides.length) {
            this.showToast('공유할 수 있는 슬라이드 데이터가 없습니다.');
            return null;
          }
          if (rawSlides.length > maxSlides) {
            this.showToast(`공유 링크는 한 번에 최대 ${maxSlides}문항까지만 생성할 수 있습니다. (현재 ${rawSlides.length}문항)`);
            return null;
          }

          await this._populateSlideViewerSnapshotsForExport(rawSlides, fullFilter, false);
          fallbackResolvedSlides = rawSlides;

          const migrateObj = {
            ...resolved,
            ...cacheTarget,
            playlistSlides: rawSlides,
            slideData: null,
            slideCount: rawSlides.length,
            isPlaylist: rawSlides.length > 1 || Boolean(cacheTarget.isPlaylist)
          };
          const migRes = await this._saveLibraryItemWithVaultOrFallback(migrateObj, cacheTarget, null, true, '공유 볼트 전환');
          if (migRes && migRes.ok && migRes.manifestItem && migRes.usedVault) {
            const idxInCache = (this.myLibraryCache || []).findIndex(x => x && x.id === cacheTarget.id);
            if (idxInCache >= 0) {
              this.myLibraryCache[idxInCache] = migRes.manifestItem;
            }
            cacheTarget = migRes.manifestItem;
            this._saveMyLibraryCacheForCurrentUser();
            hasVaultKeys = Boolean(cacheTarget._isVaultLayered && cacheTarget.vaultKeys && cacheTarget.vaultKeys.skeletonKey);
          }
        } else {
          const currentSlideCount = Math.max(1, Number(cacheTarget.slideCount) || 1);
          if (currentSlideCount > maxSlides) {
            this.showToast(`공유 링크는 한 번에 최대 ${maxSlides}문항까지만 생성할 수 있습니다. (현재 ${currentSlideCount}문항)`);
            return null;
          }
        }

        const slideCount = Math.max(
          1,
          Number(cacheTarget.slideCount) || (fallbackResolvedSlides ? fallbackResolvedSlides.length : 1)
        );
        const nowMs = Date.now();
        const quota = typeof this.getCurrentTierQuota === 'function'
          ? this.getCurrentTierQuota()
          : { tier: 'free', isGuest: !(this.cloudUser && this.cloudUser.uid), shareDailyLimit: 5, shareExpiryDays: 3, isPermanentShare: false };
        const isGuest = Boolean(quota.isGuest || !this.cloudUser || !this.cloudUser.uid);
        let isPerm = Boolean(!isGuest && quota.isPermanentShare && quota.tier === 'premium');
        let expDays = isPerm ? 0 : (Number(quota.shareExpiryDays) > 0 ? Number(quota.shareExpiryDays) : (quota.tier === 'pro' ? 7 : 3));
        let expiresAtMs = isPerm ? 0 : (nowMs + expDays * 24 * 60 * 60 * 1000);
        let premUntilMs = isPerm
          ? (Number(this._subStateMeta && (this._subStateMeta.premiumExpiresAt || this._subStateMeta.expiresAt)) || (nowMs + 31 * 24 * 60 * 60 * 1000))
          : 0;
        const shortId = 's' + nowMs.toString(36) + this._generateSecureRandomAlphaNum(10);
        const effOwnerUid = (!isGuest && this.cloudUser && this.cloudUser.uid)
          ? this.cloudUser.uid
          : this._getOrCreateGuestShareDeviceId();
        const isPremiumUser = Boolean(!isGuest && quota.tier === 'premium');
        const effPromoBanner = isPremiumUser ? this.getEffectiveSharePromoBanner() : null;

        // 4) 서버 업로드 티켓 발급 및 일일 공유 한도 · 매크로 버스트 원자적 검증 ('cloud_vault' 트랙 명시)
        const ticketRes = await this._requestShareUploadTicket(shortId, slideCount, false, 'cloud_vault');
        if (!ticketRes || !ticketRes.ok) {
          if (ticketRes && ticketRes.code === 'DAILY_SHARE_LIMIT_EXCEEDED') {
            this._syncLocalShareDailyUsage(ticketRes.kstDate, ticketRes.dailyUsed || preUsage.dailyLimit || 5);
            this._handleShareDailyLimitExceeded(preUsage.isGuest);
          } else if (ticketRes && ticketRes.code === 'SHARE_BURST_RATE_LIMIT') {
            this.showToast('⚠️ 단시간에 너무 많은 공유 링크 생성이 감지되었습니다. 잠시 후 다시 시도해 주세요.');
          } else if (ticketRes && ticketRes.code === 'FAIR_USE_SHARE_LIMIT_EXCEEDED') {
            this.showToast('⚠️ 비정상 자동화 방지를 위한 일일 공정 사용 상한에 도달했습니다. 자정 이후 초기화됩니다.');
          } else if (ticketRes && ticketRes.code === 'IP_EMERGENCY_RATE_LIMIT') {
            this.promptCloudLoginForLibrary('현재 네트워크의 비로그인 일일 한도에 도달했습니다. 무료 로그인 후 이용해 주세요.');
          } else {
            this.showToast('공유 링크 티켓 발급에 실패했습니다. 네트워크 연결을 확인해 주세요.');
          }
          return null;
        }
        if (typeof this._recordClientShareBurstStamp === 'function') {
          this._recordClientShareBurstStamp();
        }

        if (!ticketRes.fallbackLocal) {
          isPerm = Boolean(ticketRes.isPermanentShare);
          expDays = Number(ticketRes.shareExpiryDays) || 0;
          expiresAtMs = isPerm ? 0 : (Number(ticketRes.expiresAtMs) || expiresAtMs);
          premUntilMs = isPerm ? (Number(ticketRes.premiumActiveUntilMs) || premUntilMs) : 0;
        }

        // 5) 6-채널 볼트 키 보유 시: shared_workspaces/{shortId}에 슬라이드 본문 없이 허용된 레이어 난수 키만 적힌 초경량 주소표(_isVaultPointer) 업로드!
        if (hasVaultKeys && cacheTarget.vaultKeys) {
          const vk = cacheTarget.vaultKeys;
          const isFullVisual = Boolean(effFilter.includeProblem && effFilter.includeGraph && effFilter.includeInk);
          const pointerPkg = {
            id: shortId,
            _isVaultPointer: true,
            originLibraryId: cacheTarget.id,
            vaultRefs: {
              skeletonKey: vk.skeletonKey,
              probKey: effFilter.includeProblem ? (vk.probKey || null) : null,
              graphKey: effFilter.includeGraph ? (vk.graphKey || null) : null,
              inkKey: effFilter.includeInk ? (vk.inkKey || null) : null,
              audioKey: effFilter.includeAudio ? (vk.audioKey || null) : null,
              snapKey: isFullVisual ? (vk.snapKey || null) : null
            },
            vaultUpdatedAt: Number(cacheTarget.vaultUpdatedAt) || nowMs,
            title: cacheTarget.title || item.title || '공유 수업 노트',
            createdAt: nowMs,
            updatedAt: nowMs,
            expiresAt: expiresAtMs,
            shareTier: isGuest ? 'guest' : (quota.tier || 'free'),
            shareExpiryDays: expDays,
            isPermanentShare: isPerm,
            premiumActiveUntil: premUntilMs,
            promoBanner: effPromoBanner,
            ownerUid: effOwnerUid,
            exportScope: slideCount > 1 ? 'all' : 'current',
            exportFilter: { ...effFilter },
            isPlaylist: slideCount > 1 || Boolean(cacheTarget.isPlaylist),
            slideCount,
            currentIndex: 0
          };

          try {
            await this._firestoreRestWriteSingleDoc('shared_workspaces', shortId, JSON.stringify(pointerPkg), {
              ownerUid: effOwnerUid,
              expireAtMs: isPerm ? 0 : (expiresAtMs || 0),
              isPermanentShare: Boolean(isPerm),
              premiumActiveUntilMs: Number(premUntilMs) || 0,
              shareTier: pointerPkg.shareTier
            });
            if (!ticketRes.fallbackLocal) {
              await this._lockShareUploadTicketOnServer(shortId);
            }
          } catch (uploadErr) {
            await this._lockShareUploadTicketOnServer(shortId).catch(() => { });
            this.showToast('공유 링크 서버 업로드에 실패했습니다. 네트워크 상태를 확인해 주세요.');
            return null;
          }
        } else {
          // firestore.rules 배포 전(403) 비상 호환 폴백: 기존 필터링 패키지 업로드
          const filteredFallbackSlides = (fallbackResolvedSlides || []).map(s => this._applyExportFilterToSlideData(s, effFilter));
          await this._populateSlideViewerSnapshotsForExport(filteredFallbackSlides, effFilter, true);
          const legacyPkg = {
            id: shortId,
            title: cacheTarget.title || item.title || '공유 수업 노트',
            createdAt: nowMs,
            updatedAt: nowMs,
            expiresAt: expiresAtMs,
            shareTier: isGuest ? 'guest' : (quota.tier || 'free'),
            shareExpiryDays: expDays,
            isPermanentShare: isPerm,
            premiumActiveUntil: premUntilMs,
            promoBanner: effPromoBanner,
            ownerUid: effOwnerUid,
            exportScope: filteredFallbackSlides.length > 1 ? 'all' : 'current',
            exportFilter: { ...effFilter },
            isPlaylist: filteredFallbackSlides.length > 1,
            playlistSlides: filteredFallbackSlides,
            currentIndex: 0
          };
          const fullPkgJson = this._stringifyWithDeduplicatedSnapshots(legacyPkg);
          const cloudPkg = JSON.parse(fullPkgJson);
          const audioMap = {};
          let hasAnyAudio = false;
          if (Array.isArray(cloudPkg.playlistSlides)) {
            cloudPkg.playlistSlides.forEach((sl, idx) => {
              if (sl && sl.audioSyncData && sl.audioSyncData.durationMs > 0) {
                hasAnyAudio = true;
                audioMap[idx] = sl.audioSyncData;
                sl.audioSyncData = {
                  durationMs: sl.audioSyncData.durationMs,
                  stageW: sl.audioSyncData.stageW || 1440,
                  stageH: sl.audioSyncData.stageH || 900,
                  createdAt: sl.audioSyncData.createdAt || nowMs,
                  _isLazyAudioStub: true,
                  _lazySlideIdx: idx
                };
              }
            });
          }
          const audioNetStr = hasAnyAudio
            ? await this._compressJsonStringGzipBase64(JSON.stringify(audioMap))
            : '';
          try {
            const CHUNK_LIMIT = 700000;
            const audioPrefix = `${shortId}_audio_`;
            if (hasAnyAudio && audioNetStr) {
              const audioChunks = this._splitStringIntoSafeFirestoreChunks(audioNetStr, CHUNK_LIMIT);
              const AUDIO_BATCH_SIZE = 6;
              for (let b = 0; b < audioChunks.length; b += AUDIO_BATCH_SIZE) {
                const batchSlice = audioChunks.slice(b, b + AUDIO_BATCH_SIZE);
                await Promise.all(batchSlice.map((cStr, localIdx) => {
                  const idx = b + localIdx;
                  return this._firestoreRestWriteSingleDoc(
                    'shared_workspaces',
                    `${audioPrefix}${idx}`,
                    JSON.stringify({ _isChunkPart: true, _isAudioChunk: true, parentId: shortId, partIndex: idx, data: cStr }),
                    { ownerUid: `chunk_audio_${effOwnerUid}`, expireAtMs: isPerm ? 0 : (expiresAtMs || 0) }
                  );
                }));
              }
              cloudPkg._hasLazyAudio = true;
              cloudPkg._audioChunkCollection = 'shared_workspaces';
              cloudPkg._audioChunkPrefix = audioPrefix;
              cloudPkg._audioChunkCount = audioChunks.length;
            }
            await this._firestoreRestWrite('shared_workspaces', shortId, cloudPkg, {
              skipLocalFullCache: true,
              baseOwnerUid: effOwnerUid,
              expireAtMs: isPerm ? 0 : (expiresAtMs || 0),
              isPermanentShare: Boolean(isPerm),
              premiumActiveUntilMs: Number(premUntilMs) || 0
            });
            if (!ticketRes.fallbackLocal) {
              await this._lockShareUploadTicketOnServer(shortId);
            }
          } catch (uploadErr) {
            await this._lockShareUploadTicketOnServer(shortId).catch(() => { });
            this.showToast('공유 링크 서버 업로드에 실패했습니다. 네트워크 상태를 확인해 주세요.');
            return null;
          }
        }

        if (ticketRes && Number(ticketRes.dailyLimit) > 0) {
          this._syncLocalShareDailyUsage(ticketRes.kstDate, ticketRes.dailyUsed);
        }

        // 6) 현재 클라우드 파일 항목의 _shareLinksMap에 옵션별 주소표 ID 기록 및 매니페스트 즉시 동기화!
        if (!cacheTarget._shareLinksMap || typeof cacheTarget._shareLinksMap !== 'object') {
          cacheTarget._shareLinksMap = {};
        }
        cacheTarget._shareLinksMap[filterSig] = {
          shortId,
          isPermanent: Boolean(isPerm),
          expiresAt: isPerm ? 0 : (expiresAtMs || 0),
          shareExpiryDays: expDays,
          createdAt: nowMs,
          filter: { ...effFilter }
        };
        if (filterSig === '1111') {
          if (isPerm) {
            cacheTarget.linkedShareId = shortId;
            delete cacheTarget._tempShareId;
            delete cacheTarget._tempShareExpiresAt;
          } else {
            cacheTarget._tempShareId = shortId;
            cacheTarget._tempShareExpiresAt = expiresAtMs;
          }
        }
        cacheTarget.updatedAt = Date.now();
        this._saveMyLibraryCacheForCurrentUser();

        // 경량 매니페스트에도 링크 메타데이터(_shareLinksMap) 즉시 서버 동기화 (모달 재오픈·새로고침 후에도 파란불 유지!)
        if (this.cloudUser && this.cloudUser.uid && (cacheTarget._isVaultLayered || cacheTarget.linkedShareId || (cacheTarget._isChunked && cacheTarget._chunkCount && cacheTarget._chunkDocPrefix))) {
          const manifestObj = {
            ...cacheTarget,
            slideData: null,
            playlistSlides: null
          };
          this._firestoreRestWriteSingleDoc('user_library', cacheTarget.id, JSON.stringify(manifestObj)).catch(() => { });
        }

        const shareUrl = `${base}#cloud=${shortId}`;
        let copied = false;
        if (wantQr) {
          this._downloadQrCodePngForUrl(shareUrl, cacheTarget.title || item.title, effFilter);
        }
        if (wantCopy) {
          copied = await this._copyCloudTextToClipboard(shareUrl);
        }
        this.renderMyLibraryList();
        this._flashCloudShareBtnSuccess(item.id, wantQr && !wantCopy ? 'QR 저장됨' : '링크 복사됨');

        const validLabel = isPerm
          ? '영구 공유 링크'
          : `공유 링크(${expDays}일 유효)`;
        if (wantQr && !wantCopy) {
          this.showToast(isPerm
            ? `${stageToastPrefix}영구 QR 코드 이미지가 생성·저장되었습니다!`
            : `${stageToastPrefix}QR 코드 이미지(${expDays}일 유효)가 생성·저장되었습니다!`);
        } else {
          this.showToast(copied
            ? `${stageToastPrefix}${validLabel}가 생성되어 클립보드에 복사되었습니다!`
            : `${stageToastPrefix}${validLabel}: ${shareUrl}`);
        }
        return shareUrl;
      } finally {
        this._creatingDirectCloudShareIds.delete(lockKey);
        if (triggerBtnEl && triggerBtnEl.isConnected) {
          triggerBtnEl.disabled = false;
          triggerBtnEl.classList.remove('is-loading');
          triggerBtnEl.innerHTML = this._getCloudVaultIconSvg('shareLink');
        }
      }
    }

    renderMyLibraryList() {
      const listEl = document.getElementById('myLibraryList');
      const badgeEl = document.getElementById('badgeMyLibraryCount');
      const toolbarEl = document.getElementById('cloudExplorerAddressToolbar');
      const btnNavUp = document.getElementById('btnCloudNavUp');
      const crumbBar = document.getElementById('cloudExplorerBreadcrumbBar');
      const searchWrap = document.getElementById('cloudLibrarySearchWrap');
      const chipBar = document.getElementById('cloudFolderChipBar');
      const newFolderRow = document.getElementById('cloudNewFolderInlineRow');
      const sidebarEl = document.getElementById('cloudExplorerSidebar');
      const splitterEl = document.getElementById('cloudExplorerSplitter');
      const saveBarEl = document.getElementById('cloudExplorerSaveBar');
      const lblSaveFolder = document.getElementById('lblCloudExplorerSaveFolder');
      const lblCurrentPath = document.getElementById('lblCloudExplorerCurrentPath');

      if (!this.cloudUser || !this.cloudUser.uid) {
        if (badgeEl) badgeEl.textContent = '0';
        if (toolbarEl) toolbarEl.style.display = 'none';
        if (searchWrap) searchWrap.style.display = 'none';
        if (sidebarEl) sidebarEl.style.display = 'none';
        if (splitterEl) splitterEl.style.display = 'none';
        if (saveBarEl) saveBarEl.style.display = 'none';
        if (newFolderRow) newFolderRow.style.display = 'none';
        if (lblCurrentPath) lblCurrentPath.textContent = '로그인 필요';
        if (listEl) {
          listEl.innerHTML = `
          <div class="cloud-empty-msg cloud-login-empty-state">
            <span class="cloud-login-empty-icon">${this._getCloudVaultIconSvg('lock')}</span>
            <strong>클라우드 보관함은 로그인 후 이용할 수 있습니다.</strong>
            <button type="button" id="btnCloudEmptyGoLogin" class="btn-cloud-go-settings-login">설정에서 로그인하기</button>
          </div>
        `;
          const btnGoLogin = document.getElementById('btnCloudEmptyGoLogin');
          if (btnGoLogin) {
            btnGoLogin.onclick = () => {
              this.promptCloudLoginForLibrary('좌측 설정창의 [내 계정 & 클라우드]에서 로그인해 주세요.');
            };
          }
        }
        this.updateSelectedPlaylistCount();
        return;
      }

      if (toolbarEl) toolbarEl.style.display = 'flex';
      if (searchWrap) searchWrap.style.display = 'flex';
      if (sidebarEl) sidebarEl.style.display = 'flex';
      if (splitterEl) splitterEl.style.display = 'flex';
      if (saveBarEl) saveBarEl.style.display = 'flex';
      if (chipBar) chipBar.style.display = 'flex';
      if (typeof this._syncCloudExplorerScopeUI === 'function') {
        this._syncCloudExplorerScopeUI();
      }

      this.myLibraryCache = (this.myLibraryCache || []).filter(it => this._isOwnedByCurrentCloudUser(it));
      const totalCount = this.myLibraryCache.length;
      if (badgeEl) badgeEl.textContent = String(totalCount);

      // 0. 좌측 하단 클라우드 사용 용량 게이지 동기화 (Free 100MB / Pro 5GB / Premium 20GB)
      const quotaBoxEl = document.getElementById('cloudStorageQuotaBox');
      if (quotaBoxEl) {
        const quota = typeof this.getCurrentTierQuota === 'function'
          ? this.getCurrentTierQuota()
          : { tier: 'free', tierLabel: '무료', maxCloudBytes: 100 * 1024 * 1024, maxCloudLabel: '100 MB' };
        const usedBytes = this.getUserCloudLibraryTotalBytes();
        const maxBytes = Math.max(1, Number(quota.maxCloudBytes) || (100 * 1024 * 1024));
        const ratioPct = Math.min(100, Math.max(0, (usedBytes / maxBytes) * 100));

        const badgeTierEl = document.getElementById('lblCloudQuotaTierBadge');
        const btnUpgEl = document.getElementById('btnCloudQuotaUpgrade');
        const barFillEl = document.getElementById('barCloudQuotaFill');
        const usageTxtEl = document.getElementById('lblCloudQuotaUsageText');

        if (badgeTierEl) {
          badgeTierEl.className = 'cloud-quota-tier-badge tier-' + quota.tier + ' is-' + quota.tier;
          badgeTierEl.textContent = quota.tier === 'premium'
            ? 'Premium 플랜'
            : (quota.tier === 'pro' ? 'Pro 플랜' : '무료 플랜');
          const subInfo = typeof this.getSubscriptionRemainingInfo === 'function'
            ? this.getSubscriptionRemainingInfo()
            : null;
          if (subInfo && subInfo.isPaid && subInfo.remainingDays > 0) {
            const dateSuffix = subInfo.formattedDate ? ` (${subInfo.formattedDate}까지)` : '';
            badgeTierEl.title = `${subInfo.remainingDays}일 남음${dateSuffix}`;
          } else {
            badgeTierEl.title = '';
          }
        }
        if (btnUpgEl) {
          if (quota.tier === 'premium') {
            btnUpgEl.style.display = 'none';
          } else {
            btnUpgEl.style.display = 'inline-flex';
            const upgLabel = quota.tier === 'pro' ? '20GB 확장' : '용량 확장';
            btnUpgEl.innerHTML = `<span>${upgLabel}</span>${this._getCloudVaultIconSvg('arrowUpRight')}`;
          }
        }
        if (barFillEl) {
          barFillEl.style.width = `${ratioPct.toFixed(1)}%`;
          barFillEl.classList.toggle('is-warn', ratioPct >= 80 && ratioPct < 95);
          barFillEl.classList.toggle('is-danger', ratioPct >= 95);
        }
        if (usageTxtEl) {
          const usedStr = typeof this.formatBytesHuman === 'function' ? this.formatBytesHuman(usedBytes) : `${usedBytes} B`;
          const pctStr = ratioPct < 0.1 && usedBytes > 0 ? '0.1' : ratioPct.toFixed(ratioPct >= 10 ? 0 : 1);
          usageTxtEl.textContent = `${usedStr} / ${quota.maxCloudLabel} (${pctStr}%)`;
        }
      }

      // 1. 폴더 트리 전체 경로 목록 조회 및 현재 경로 정규화
      const allFolderPaths = this.getCloudFoldersList();
      if (this._activeCloudFolder === '__UNCATEGORIZED__') {
        this._activeCloudFolder = '';
      }
      if (this._activeCloudFolder && this._activeCloudFolder !== '__ALL_RECENT__' && !allFolderPaths.includes(this._activeCloudFolder)) {
        this._activeCloudFolder = '';
      }
      const activeFolder = this._activeCloudFolder || '';
      const isAllRecentMode = (activeFolder === '__ALL_RECENT__');
      const saveTargetFolder = isAllRecentMode ? '' : activeFolder;

      if (lblSaveFolder) {
        lblSaveFolder.textContent = saveTargetFolder
          ? `(${this._cleanCloudFolderDisplayLabel(saveTargetFolder.split('/').pop())})`
          : '(내 클라우드)';
      }
      if (btnNavUp) {
        btnNavUp.disabled = (!activeFolder);
      }

      if (!this._selectedCloudExplorerKeys) {
        this._selectedCloudExplorerKeys = new Set();
      }

      // 내 PC(윈도우 탐색기 등)에서 .graphly 파일을 끌어다 놓았을 때 해당 폴더로 즉시 업로드하는 외부 파일 드롭 전용 헬퍼
      const bindExternalFileDropTarget = (el, targetPath) => {
        if (!el) return;
        el.dataset.dropFolder = targetPath;
        el.ondragover = (e) => {
          const isExternalFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
          if (!isExternalFiles) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          if (listEl && listEl !== el) listEl.classList.remove('drop-target-hover');
          el.classList.add('drop-target-hover');
        };
        el.ondragleave = (e) => {
          if (!el.contains(e.relatedTarget)) {
            el.classList.remove('drop-target-hover');
          }
        };
        el.ondrop = (e) => {
          if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
          e.preventDefault();
          e.stopPropagation();
          el.classList.remove('drop-target-hover');
          this.uploadLocalGraphlyFilesToCloud(e.dataTransfer.files, targetPath);
        };
      };

      // 2. 상단 탐색기 주소 표시줄 (Breadcrumb) 렌더링
      if (crumbBar) {
        crumbBar.innerHTML = '';
        const homeCrumb = document.createElement('button');
        homeCrumb.type = 'button';
        homeCrumb.className = 'win-crumb-item' + (activeFolder === '' ? ' active' : '');
        homeCrumb.innerHTML = `${this._getCloudVaultIconSvg('cloudRoot')}<span>내 클라우드</span>`;
        homeCrumb.onclick = () => {
          this._activeCloudFolder = '';
          this._selectedCloudExplorerKeys.clear();
          this.syncExportCloudFolderSelect();
          this.renderMyLibraryList();
        };
        bindExternalFileDropTarget(homeCrumb, '');
        crumbBar.appendChild(homeCrumb);

        if (isAllRecentMode) {
          const sep = document.createElement('span');
          sep.className = 'win-crumb-sep';
          sep.textContent = '›';
          crumbBar.appendChild(sep);

          const recCrumb = document.createElement('button');
          recCrumb.type = 'button';
          recCrumb.className = 'win-crumb-item active';
          recCrumb.innerHTML = `${this._getCloudVaultIconSvg('allFiles')}<span>전체 파일 보기</span>`;
          crumbBar.appendChild(recCrumb);
        } else if (activeFolder) {
          const segs = activeFolder.split('/');
          let accum = '';
          segs.forEach((seg, idx) => {
            accum = accum ? `${accum}/${seg}` : seg;
            const targetP = accum;
            const sep = document.createElement('span');
            sep.className = 'win-crumb-sep';
            sep.textContent = '›';
            crumbBar.appendChild(sep);

            const isLast = (idx === segs.length - 1);
            const cBtn = document.createElement('button');
            cBtn.type = 'button';
            cBtn.className = 'win-crumb-item' + (isLast ? ' active is-current-seg' : '');
            cBtn.innerHTML = `${this._getCloudVaultIconSvg(isLast ? 'folderOpen' : 'folderClosed')}<span>${this._escapeHtmlStr(this._cleanCloudFolderDisplayLabel(seg))}</span>`;
            cBtn.onclick = () => {
              this._activeCloudFolder = targetP;
              this._selectedCloudExplorerKeys.clear();
              this.syncExportCloudFolderSelect();
              this.renderMyLibraryList();
            };
            bindExternalFileDropTarget(cBtn, targetP);
            crumbBar.appendChild(cBtn);
          });
        }
      }

      // 3. 좌측 폴더 트리 사이드바 렌더링
      if (!this._collapsedCloudFolders) {
        this._collapsedCloudFolders = new Set();
      }

      const getDirectChildFolders = (parentPath) => {
        return allFolderPaths.filter(p => {
          if (!parentPath) return !p.includes('/');
          return p.startsWith(parentPath + '/') && !p.slice(parentPath.length + 1).includes('/');
        });
      };

      if (chipBar) {
        chipBar.innerHTML = '';

        // (A) 루트: 내 클라우드
        const homeNode = document.createElement('div');
        homeNode.className = 'cloud-tree-node' + (activeFolder === '' ? ' active' : '');
        homeNode.innerHTML = `
        <div class="cloud-tree-node-left">
          <span class="cloud-tree-icon">${this._getCloudVaultIconSvg('cloudRoot')}</span>
          <span class="cloud-tree-name">내 클라우드</span>
        </div>
      `;
        homeNode.onclick = () => {
          this._activeCloudFolder = '';
          this._selectedCloudExplorerKeys.clear();
          this.syncExportCloudFolderSelect();
          this.renderMyLibraryList();
        };
        bindExternalFileDropTarget(homeNode, '');
        chipBar.appendChild(homeNode);

        // (B) 재귀 폴더 트리 노드 렌더링
        const renderFolderTreeLevel = (parentPath, ancestorContinuationFlags = []) => {
          const children = getDirectChildFolders(parentPath);
          children.forEach((fPath, idx) => {
            const isLastSibling = (idx === children.length - 1);
            const segName = fPath.split('/').pop();
            const subChildren = getDirectChildFolders(fPath);
            const hasSubs = subChildren.length > 0;
            const isCollapsed = this._collapsedCloudFolders.has(fPath);
            const isAct = (activeFolder === fPath);
            const isOpenBranch = isAct || activeFolder.startsWith(fPath + '/');

            let indentGuidesHtml = '<span class="cloud-tree-indent-group">';
            for (let d = 0; d < ancestorContinuationFlags.length; d++) {
              const keepVerticalLine = ancestorContinuationFlags[d];
              indentGuidesHtml += `<span class="cloud-tree-indent-guide${keepVerticalLine ? ' has-vline' : ' is-blank'}"></span>`;
            }
            indentGuidesHtml += `<span class="cloud-tree-indent-guide is-branch${isLastSibling ? ' is-last-branch' : ''}"></span>`;
            indentGuidesHtml += '</span>';

            const safeTreePathTitle = this._escapeHtmlStr(this._cleanCloudFolderPathLabel(fPath));
            const safeTreeSegName = this._escapeHtmlStr(this._cleanCloudFolderDisplayLabel(segName));
            const node = document.createElement('div');
            node.className = 'cloud-tree-node' + (isAct ? ' active' : '');
            node.innerHTML = `
            <div class="cloud-tree-node-left">
              ${indentGuidesHtml}
              <span class="cloud-tree-icon">${this._getCloudVaultIconSvg(isOpenBranch ? 'folderOpen' : 'folderClosed')}</span>
              <span class="cloud-tree-name" title="${safeTreePathTitle}">${safeTreeSegName}</span>
            </div>
          `;

            node.onclick = () => {
              if (this._activeCloudFolder === fPath && hasSubs) {
                if (this._collapsedCloudFolders.has(fPath)) {
                  this._collapsedCloudFolders.delete(fPath);
                } else {
                  this._collapsedCloudFolders.add(fPath);
                }
              } else {
                this._activeCloudFolder = fPath;
                if (hasSubs && this._collapsedCloudFolders.has(fPath)) {
                  this._collapsedCloudFolders.delete(fPath);
                }
              }
              this._selectedCloudExplorerKeys.clear();
              this.syncExportCloudFolderSelect();
              this.renderMyLibraryList();
            };

            bindExternalFileDropTarget(node, fPath);
            chipBar.appendChild(node);

            if (hasSubs && !isCollapsed) {
              renderFolderTreeLevel(fPath, [...ancestorContinuationFlags, !isLastSibling]);
            }
          });
        };

        renderFolderTreeLevel('', []);

        // (C) 하단 구분선 + 전체 파일 모아보기
        const divider = document.createElement('div');
        divider.className = 'cloud-tree-divider';
        chipBar.appendChild(divider);

        const allRecentNode = document.createElement('div');
        allRecentNode.className = 'cloud-tree-node' + (isAllRecentMode ? ' active' : '');
        allRecentNode.innerHTML = `
        <div class="cloud-tree-node-left">
          <span class="cloud-tree-icon">${this._getCloudVaultIconSvg('allFiles')}</span>
          <span class="cloud-tree-name">전체 파일 보기</span>
        </div>
      `;
        allRecentNode.onclick = () => {
          this._activeCloudFolder = '__ALL_RECENT__';
          this._selectedCloudExplorerKeys.clear();
          this.renderMyLibraryList();
        };
        chipBar.appendChild(allRecentNode);
      }

      if (!listEl) return;
      listEl.innerHTML = '';

      // 내 PC 탐색기에서 우측 파일 목록으로 .graphly 파일을 여러 개 드래그 앤 드롭하면 현재 열린 폴더에 즉시 업로드
      listEl.ondragover = (e) => {
        const isExternalFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
        if (!isExternalFiles) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        listEl.classList.add('drop-target-hover');
      };
      listEl.ondragleave = (e) => {
        if (!listEl.contains(e.relatedTarget)) {
          listEl.classList.remove('drop-target-hover');
        }
      };
      listEl.ondrop = (e) => {
        if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        listEl.classList.remove('drop-target-hover');
        this.uploadLocalGraphlyFilesToCloud(e.dataTransfer.files, saveTargetFolder);
      };

      const q = String(this._cloudLibrarySearchQuery || '').trim().toLowerCase();

      // 폴더별 직계 항목 수(하위 폴더 + 파일) 사전 집계
      const folderItemCountMap = new Map();
      allFolderPaths.forEach(fp => {
        folderItemCountMap.set(fp, getDirectChildFolders(fp).length);
      });
      this.myLibraryCache.forEach(it => {
        if (!it) return;
        const fp = String(it.folder || '').trim();
        if (fp) {
          folderItemCountMap.set(fp, (folderItemCountMap.get(fp) || 0) + 1);
        }
      });

      // 4. 우측 메인 탐색기 영역: (1) 하위 폴더 행 + (2) 파일 행
      const visibleFolders = q
        ? allFolderPaths.filter(f => f.toLowerCase().includes(q))
        : (isAllRecentMode ? [] : getDirectChildFolders(activeFolder));

      const filteredItems = this.myLibraryCache.filter(item => {
        const itemFolder = String(item.folder || '').trim();
        if (q) {
          const hay = `${item.title || ''} ${item.tags || ''} ${item.folder || ''} ${item.summary || ''}`.toLowerCase();
          return hay.includes(q);
        }
        if (isAllRecentMode) return true;
        return itemFolder === activeFolder;
      });

      this._currentVisibleCloudKeys = [
        ...visibleFolders.map(fPath => `folder:${fPath}`),
        ...filteredItems.map(it => `file:${it.id}`)
      ];
      const visibleKeySet = new Set(this._currentVisibleCloudKeys);
      Array.from(this._selectedCloudExplorerKeys).forEach(k => {
        if (!visibleKeySet.has(k)) {
          this._selectedCloudExplorerKeys.delete(k);
        }
      });

      const syncAllRowSelectionsInPlace = () => {
        const rows = listEl.querySelectorAll('.win-explorer-row[data-row-key]');
        rows.forEach(r => {
          const rk = r.dataset.rowKey;
          const sel = this._selectedCloudExplorerKeys.has(rk);
          r.classList.toggle('selected', sel);
          const chk = r.querySelector('.win-explorer-checkbox');
          if (chk) chk.checked = sel;
        });
        this._syncCloudExplorerSelectionButtons();
        this.updateSelectedPlaylistCount();
      };

      listEl.onclick = (e) => {
        if (e.target === listEl) {
          this._selectedCloudExplorerKeys.clear();
          syncAllRowSelectionsInPlace();
        }
      };

      const handleRowSelectionClick = (rowKey, e) => {
        if (e && e.detail >= 2) return;
        const visKeys = this._currentVisibleCloudKeys || [];
        if (e.shiftKey && this._lastClickedCloudExplorerKey && visKeys.includes(this._lastClickedCloudExplorerKey)) {
          const idxA = visKeys.indexOf(this._lastClickedCloudExplorerKey);
          const idxB = visKeys.indexOf(rowKey);
          if (idxA !== -1 && idxB !== -1) {
            const [start, end] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
            for (let i = start; i <= end; i++) {
              this._selectedCloudExplorerKeys.add(visKeys[i]);
            }
          }
        } else if (e.ctrlKey || e.metaKey) {
          if (this._selectedCloudExplorerKeys.has(rowKey)) {
            this._selectedCloudExplorerKeys.delete(rowKey);
          } else {
            this._selectedCloudExplorerKeys.add(rowKey);
          }
        } else {
          if (this._selectedCloudExplorerKeys.size === 1 && this._selectedCloudExplorerKeys.has(rowKey)) {
            this._selectedCloudExplorerKeys.clear();
          } else {
            this._selectedCloudExplorerKeys.clear();
            this._selectedCloudExplorerKeys.add(rowKey);
          }
        }
        this._lastClickedCloudExplorerKey = rowKey;
        syncAllRowSelectionsInPlace();
      };

      visibleFolders.forEach(fPath => {
        const segName = fPath.split('/').pop();
        const displaySegName = this._cleanCloudFolderDisplayLabel(segName);
        const rowKey = `folder:${fPath}`;
        const isSelected = this._selectedCloudExplorerKeys.has(rowKey);
        const row = document.createElement('div');
        row.className = 'win-explorer-row is-folder-row' + (isSelected ? ' selected' : '');
        row.dataset.rowKey = rowKey;

        const safeRowSegName = this._escapeHtmlStr(displaySegName);
        const safeRawSegVal = this._escapeHtmlStr(segName);
        if (this._renamingCloudFolderPath === fPath) {
          row.classList.add('is-renaming-row');
          row.innerHTML = `
          <div class="win-inline-rename-wrap">
            <span class="win-row-icon is-folder-icon">${this._getCloudVaultIconSvg('folderClosed')}</span>
            <input type="text" class="cloud-item-rename-input" value="${safeRawSegVal}" />
            <button type="button" class="btn-primary cloud-item-rename-save">확인</button>
            <button type="button" class="btn-secondary cloud-item-rename-cancel">취소</button>
          </div>
        `;
          const inpRen = row.querySelector('.cloud-item-rename-input');
          const btnSaveRen = row.querySelector('.cloud-item-rename-save');
          const btnCancelRen = row.querySelector('.cloud-item-rename-cancel');
          if (inpRen) {
            inpRen.onclick = (e) => e.stopPropagation();
            inpRen.onkeydown = (e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                this.renameCloudFolder(fPath, inpRen.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                this._renamingCloudFolderPath = null;
                this.renderMyLibraryList();
              }
            };
            setTimeout(() => { inpRen.focus(); inpRen.select(); }, 20);
          }
          if (btnSaveRen) {
            btnSaveRen.onclick = (e) => {
              e.stopPropagation();
              this.renameCloudFolder(fPath, inpRen ? inpRen.value : segName);
            };
          }
          if (btnCancelRen) {
            btnCancelRen.onclick = (e) => {
              e.stopPropagation();
              this._renamingCloudFolderPath = null;
              this.renderMyLibraryList();
            };
          }
          listEl.appendChild(row);
          return;
        }

        const folderCnt = folderItemCountMap.get(fPath) || 0;
        const folderCntHtml = folderCnt > 0
          ? `<span class="win-folder-item-count">${folderCnt}개 항목</span>`
          : '';

        row.innerHTML = `
        <label class="win-row-chk-wrap" title="체크하여 폴더 선택">
          <input type="checkbox" class="win-explorer-checkbox" ${isSelected ? 'checked' : ''}>
        </label>
        <div class="win-row-name-col" title="클릭하여 [${safeRowSegName}] 폴더 열기">
          <span class="win-row-icon is-folder-icon">${this._getCloudVaultIconSvg('folderClosed')}</span>
          <span class="win-row-title">${safeRowSegName}</span>
          ${folderCntHtml}
        </div>
        <div class="win-row-act-col">
          <button type="button" class="btn-cloud-edit-item" title="폴더 이름 바꾸기 (F2)">${this._getCloudVaultIconSvg('renamePencil')}</button>
        </div>
      `;

        const enterFolder = () => {
          this._activeCloudFolder = fPath;
          this._selectedCloudExplorerKeys.clear();
          if (!this._collapsedCloudFolders) this._collapsedCloudFolders = new Set();
          this._collapsedCloudFolders.delete(fPath);
          this.syncExportCloudFolderSelect();
          this.renderMyLibraryList();
        };

        const chkEl = row.querySelector('.win-explorer-checkbox');
        const chkLabel = row.querySelector('.win-row-chk-wrap');
        if (chkLabel) {
          chkLabel.onclick = (e) => e.stopPropagation();
        }
        if (chkEl) {
          chkEl.onchange = (e) => {
            e.stopPropagation();
            if (chkEl.checked) {
              this._selectedCloudExplorerKeys.add(rowKey);
            } else {
              this._selectedCloudExplorerKeys.delete(rowKey);
            }
            this._lastClickedCloudExplorerKey = rowKey;
            syncAllRowSelectionsInPlace();
          };
        }

        row.onclick = (e) => {
          if (e.target && (e.target.closest('.win-row-chk-wrap') || e.target.closest('.win-row-act-col'))) {
            return;
          }
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            handleRowSelectionClick(rowKey, e);
            return;
          }
          enterFolder();
        };

        row.ondblclick = (e) => {
          if (e.target && (e.target.closest('.win-row-chk-wrap') || e.target.closest('.win-row-act-col'))) return;
          e.preventDefault();
          enterFolder();
        };

        const btnEditF = row.querySelector('.btn-cloud-edit-item');
        if (btnEditF) {
          btnEditF.onclick = (e) => {
            e.stopPropagation();
            this._renamingCloudFolderPath = fPath;
            this.renderMyLibraryList();
          };
        }

        bindExternalFileDropTarget(row, fPath);
        listEl.appendChild(row);
      });

      if (visibleFolders.length === 0 && filteredItems.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'cloud-empty-msg';
        emptyDiv.innerHTML = q ? `검색 결과가 없습니다.` : `이 폴더가 비어 있습니다.`;
        listEl.appendChild(emptyDiv);
        this._syncCloudExplorerSelectionButtons();
        this.updateSelectedPlaylistCount();
        return;
      }

      filteredItems.forEach((item) => {
        const rowKey = `file:${item.id}`;
        const isSelected = this._selectedCloudExplorerKeys.has(rowKey);
        const row = document.createElement('div');
        row.className = 'win-explorer-row is-file-row' + (isSelected ? ' selected' : '');
        row.dataset.rowKey = rowKey;
        const curFolder = String(item.folder || '').trim();
        const safeCurFolderBadge = this._escapeHtmlStr(this._cleanCloudFolderPathLabel(curFolder));
        const safeItemTitle = this._escapeHtmlStr(item.title || '제목 없음');
        const safeItemTitleVal = this._escapeHtmlStr(item.title || '');
        const folderBadgeHtml = ((isAllRecentMode || q) && curFolder)
          ? `<span class="cloud-item-folder-badge" title="소속 폴더">${this._getCloudVaultIconSvg('folderMini')}<span>${safeCurFolderBadge}</span></span>`
          : '';

        if (this._renamingCloudItemId === item.id) {
          row.classList.add('is-renaming-row');
          row.innerHTML = `
          <div class="win-inline-rename-wrap">
            <span class="win-row-icon is-file-icon">${this._getCloudVaultIconSvg('graphlyFile')}</span>
            <input type="text" class="cloud-item-rename-input" value="${safeItemTitleVal}" />
            <button type="button" class="btn-primary cloud-item-rename-save">확인</button>
            <button type="button" class="btn-secondary cloud-item-rename-cancel">취소</button>
          </div>
        `;
          const inpRen = row.querySelector('.cloud-item-rename-input');
          const btnSaveRen = row.querySelector('.cloud-item-rename-save');
          const btnCancelRen = row.querySelector('.cloud-item-rename-cancel');
          if (inpRen) {
            inpRen.onclick = (e) => e.stopPropagation();
            inpRen.onkeydown = (e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                this.renameCloudLibraryItem(item, inpRen.value);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                this._renamingCloudItemId = null;
                this.renderMyLibraryList();
              }
            };
            setTimeout(() => { inpRen.focus(); inpRen.select(); }, 20);
          }
          if (btnSaveRen) {
            btnSaveRen.onclick = (e) => {
              e.stopPropagation();
              this.renameCloudLibraryItem(item, inpRen ? inpRen.value : item.title);
            };
          }
          if (btnCancelRen) {
            btnCancelRen.onclick = (e) => {
              e.stopPropagation();
              this._renamingCloudItemId = null;
              this.renderMyLibraryList();
            };
          }
          listEl.appendChild(row);
          return;
        }

        const activeShareCount = this._countActiveCloudItemShares(item);
        const hasActiveShare = activeShareCount > 0;
        const isPermShare = this._hasPermanentCloudItemShare(item);
        const isPopoverOpenOnItem = (this._activeCloudSharePopoverItemId === item.id);
        const badgeLabelText = activeShareCount > 1 ? `공유 링크 ${activeShareCount}` : '공유 링크';
        const permLinkBadgeHtml = hasActiveShare
          ? `<span class="cloud-perm-link-badge" title="${isPermShare ? '영구 공유 링크 연동 파일 (클릭하여 옵션별 링크 복사 · QR 저장)' : '발급된 공유 링크 활성 (클릭하여 옵션별 링크 복사 · QR 저장)'}">${this._getCloudVaultIconSvg('shareBadgeLink')}<span>${badgeLabelText}</span></span>`
          : '';
        const itemSizeHtml = (Number(item.byteSize) > 0 && typeof this.formatBytesHuman === 'function')
          ? `<span class="win-row-byte-size">${this.formatBytesHuman(item.byteSize)}</span>`
          : '';
        const shareBtnTitle = '공유 옵션 선택 · 링크 복사 및 QR 저장';

        row.innerHTML = `
        <label class="win-row-chk-wrap" title="체크하여 다중 선택">
          <input type="checkbox" class="win-explorer-checkbox" ${isSelected ? 'checked' : ''}>
        </label>
        <div class="win-row-name-col" title="더블클릭하여 칠판에 열기">
          <span class="win-row-icon is-file-icon">${this._getCloudVaultIconSvg('graphlyFile')}</span>
          ${folderBadgeHtml}
          <span class="win-row-title">${safeItemTitle}</span>
          ${permLinkBadgeHtml}
        </div>
        <div class="win-row-act-col">
          ${itemSizeHtml}
          <button type="button" class="btn-cloud-share-item${hasActiveShare ? ' is-link-active' : ''}${isPopoverOpenOnItem ? ' is-popover-open' : ''}" title="${shareBtnTitle}">${this._getCloudVaultIconSvg('shareLink')}</button>
          <button type="button" class="btn-cloud-edit-item" title="파일 이름 바꾸기 (F2)">${this._getCloudVaultIconSvg('renamePencil')}</button>
        </div>
      `;

        const chkEl = row.querySelector('.win-explorer-checkbox');
        const chkLabel = row.querySelector('.win-row-chk-wrap');
        if (chkLabel) {
          chkLabel.onclick = (e) => e.stopPropagation();
        }
        if (chkEl) {
          chkEl.onchange = (e) => {
            e.stopPropagation();
            if (chkEl.checked) {
              this._selectedCloudExplorerKeys.add(rowKey);
            } else {
              this._selectedCloudExplorerKeys.delete(rowKey);
            }
            this._lastClickedCloudExplorerKey = rowKey;
            syncAllRowSelectionsInPlace();
          };
        }

        row.onclick = (e) => {
          if (e.target && (e.target.closest('.win-row-chk-wrap') || e.target.closest('.win-row-act-col') || e.target.closest('.cloud-perm-link-badge'))) {
            return;
          }
          handleRowSelectionClick(rowKey, e);
        };

        row.ondblclick = (e) => {
          if (e.target && (e.target.closest('.win-row-chk-wrap') || e.target.closest('.win-row-act-col') || e.target.closest('.cloud-perm-link-badge'))) {
            return;
          }
          e.preventDefault();
          if (typeof this.closeCloudItemSharePopover === 'function') {
            this.closeCloudItemSharePopover();
          }
          this.loadCloudItemToWorkspace(item, true);
        };

        const btnShare = row.querySelector('.btn-cloud-share-item');
        if (btnShare) {
          btnShare.onclick = (e) => {
            e.stopPropagation();
            this.openCloudItemSharePopover(item, btnShare);
          };
        }

        const badgeShareEl = row.querySelector('.cloud-perm-link-badge');
        if (badgeShareEl) {
          badgeShareEl.onclick = (e) => {
            e.stopPropagation();
            this.openCloudItemSharePopover(item, btnShare || badgeShareEl);
          };
        }

        const btnEdit = row.querySelector('.btn-cloud-edit-item');
        if (btnEdit) {
          btnEdit.onclick = (e) => {
            e.stopPropagation();
            if (typeof this.closeCloudItemSharePopover === 'function') {
              this.closeCloudItemSharePopover();
            }
            this._renamingCloudItemId = item.id;
            this.renderMyLibraryList();
          };
        }

        listEl.appendChild(row);
      });

      if (this._activeCloudSharePopoverItemId) {
        const stillVisible = filteredItems.some(it => it && it.id === this._activeCloudSharePopoverItemId) &&
          this._renamingCloudItemId !== this._activeCloudSharePopoverItemId;
        if (!stillVisible) {
          this.closeCloudItemSharePopover();
        } else {
          this._activeCloudSharePopoverAnchorBtn = this._findCloudRowShareBtn(this._activeCloudSharePopoverItemId);
          this._syncCloudShareOptionPopoverUI();
          this._positionCloudShareOptionPopover();
        }
      }

      this._syncCloudExplorerSelectionButtons();
      this.updateSelectedPlaylistCount();
    }

    updateSelectedPlaylistCount() {
      const fileCnt = Array.from(this._selectedCloudExplorerKeys || []).filter(k => k.startsWith('file:')).length;
      const lbl = document.getElementById('lblSelectedPlaylistCount');
      if (lbl) lbl.textContent = String(fileCnt);
    }

    // ============================================================================
    // 🎯 [수업 슬라이드(PPT) 플레이리스트 모드: 1번 ➔ 2번 ➔ 3번 연속 수업 & 필기 자동 보존]
    // ============================================================================
    async startPlaylistFromSelectedLibraryItems() {
      const selectedSlides = await this._collectSelectedLibrarySlides();
      if (!selectedSlides.length) {
        this.showToast('⚠️ 캔버스로 시작할 문항을 1개 이상 체크해 주세요!');
        return;
      }
      this._activeLoadedCloudLibraryMeta = null;
      this.startLessonPlaylist(selectedSlides, 0);

      const modalCloud = document.getElementById('modalCloudHub');
      if (modalCloud) modalCloud.classList.remove('show');

      const normalizedPkg = {
        id: 'lib_sel_' + Date.now().toString(36),
        createdAt: Date.now(),
        playlistSlides: JSON.parse(JSON.stringify(selectedSlides)),
        isPlaylist: selectedSlides.length > 1,
        currentIndex: 0
      };
      this._initialSharedCloudPkg = JSON.parse(JSON.stringify(normalizedPkg));
      await this.openSmartNoteViewer(normalizedPkg);
    }

    startLessonPlaylist(slidesArray, startIndex = 0) {
      if (!Array.isArray(slidesArray) || slidesArray.length === 0) return;
      const hasPageSlides = slidesArray.some(s => Boolean(s && s.pdfPageBoardData));
      this.setLessonTeachingMode(hasPageSlides ? 'page' : 'crop');
      this.lessonPlaylistSlides = JSON.parse(JSON.stringify(slidesArray));
      this.lessonPlaylistIndex = Math.max(0, Math.min(slidesArray.length - 1, startIndex));
      this.isLessonPlaylistActive = true;

      this.deserializeFullSlideState(this.lessonPlaylistSlides[this.lessonPlaylistIndex]);
      this.syncLessonPlaylistNavBarUI();
      this.showToast(`🎯 수업 캔버스 시작! (${this.lessonPlaylistIndex + 1} / ${this.lessonPlaylistSlides.length} : ${this.lessonPlaylistSlides[this.lessonPlaylistIndex].slideTitle || '문항'})`);
    }

    saveCurrentSlideIntoPlaylist() {
      if (this._isCapturingExportSnapshots || this.isStudentAudioVideoOnlyMode) return;
      if (!this.isLessonPlaylistActive || !this.lessonPlaylistSlides || !this.lessonPlaylistSlides.length) return;
      const curSlide = this.lessonPlaylistSlides[this.lessonPlaylistIndex];
      const title = curSlide ? curSlide.slideTitle : `문항 ${this.lessonPlaylistIndex + 1}`;
      this.lessonPlaylistSlides[this.lessonPlaylistIndex] = this.serializeFullSlideState(title);
    }

    stepLessonPlaylist(delta) {
      if (!this.isLessonPlaylistActive || !this.lessonPlaylistSlides || !this.lessonPlaylistSlides.length) return;
      const nextIdx = this.lessonPlaylistIndex + delta;
      if (nextIdx < 0 || nextIdx >= this.lessonPlaylistSlides.length) return;

      const wasRecording = Boolean(this.isAudioRecording);
      const wasPlayingAudio = Boolean(this.isAudioPlaying);
      if (wasRecording) {
        this._finalizeCurrentSlideAudioSegmentBeforeSwitch(nextIdx);
      } else if (this._isAudioReplayActive || this.isAudioPlaying) {
        this.stopAudioPlayback(true);
      }

      // 1. 현재 슬라이드에서 판서한 필기/그래프 카드 변동을 현재 슬라이드에 자동 백업!
      this.saveCurrentSlideIntoPlaylist();

      // 2. 목표 슬라이드 로드
      this.lessonPlaylistIndex = nextIdx;
      const targetSlide = this.lessonPlaylistSlides[this.lessonPlaylistIndex];
      this.deserializeFullSlideState(targetSlide);
      if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets') {
        document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
        this._pipTargetCard = 'new';
        this._pipSessionOrigin = 'rail';
        const btnPresets = document.getElementById('btnRailPresets');
        if (btnPresets) btnPresets.classList.add('active');
      } else {
        this._pipTargetCard = null;
        this._pipSessionOrigin = null;
      }
      if (wasRecording) {
        this._beginNextSlideAudioSegmentAfterSwitch();
      } else if (wasPlayingAudio && this.audioSyncData && this.audioSyncData.durationMs > 0) {
        this.playAudioSync(0, 'video');
      } else if (this.isStudentAudioVideoOnlyMode && this.audioSyncData && this.audioSyncData.durationMs > 0) {
        this.audioPlayCurrentMs = 0;
        this._lastAppliedAudioStateObj = null;
        this._replayInkBakeKey = '';
        this._isAudioReplayActive = true;
        document.body.classList.add('audio-replay-active');
        if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();
        this._applyAudioTimelineStateAt(0);
        this._renderAudioReplayAtCurrentTime();
        this.syncAudioRecordUI();
      } else if (this.isStudentAudioVideoOnlyMode) {
        this.stopAudioPlayback(true);
        this.exitStudentAudioVideoOnlyMode();
        if (this._viewerPkg) {
          this._viewerPkg.currentIndex = this.lessonPlaylistIndex;
          this.openSmartNoteViewer(this._viewerPkg, true);
        }
        return;
      } else if (typeof this._syncReplayFixedStageLayout === 'function') {
        this._syncReplayFixedStageLayout();
      }
      this.syncLessonPlaylistNavBarUI();
      this.showToast(`🎯 [${this.lessonPlaylistIndex + 1} / ${this.lessonPlaylistSlides.length}] ${targetSlide.slideTitle || '문항'}`);
    }

    closeLessonPlaylistMode() {
      this.saveCurrentSlideIntoPlaylist();
      this.isLessonPlaylistActive = false;
      this.syncLessonPlaylistNavBarUI();
      this.showToast('캔버스 모드를 종료했습니다.');
    }

    hasAnyWorkspaceContent() {
      const pWidget = document.getElementById('problemCardWidget');
      const hasPrimaryProblem = Boolean(pWidget && this.problemCardData && !this._retainedPdfAudioProbCard);
      const hasExtraProblems = Boolean(this.extraProblemCards && this.extraProblemCards.length > 0);
      const hasGraphCards = Boolean(
        (this._hasPrimaryGraphCard && this.graphCardData) ||
        (this.extraGraphCards && this.extraGraphCards.length > 0)
      );
      const hasBackedUpGraphs = Boolean(
        this._coveredGraphStateBackup &&
        Array.isArray(this._coveredGraphStateBackup.graphs) &&
        this._coveredGraphStateBackup.graphs.length > 0
      );
      return Boolean(
        (this.graphs && this.graphs.length > 0) ||
        hasBackedUpGraphs ||
        (this.inkStrokes && this.inkStrokes.length > 0) ||
        (this.boardStickers && this.boardStickers.length > 0) ||
        (this.dropLines && this.dropLines.length > 0) ||
        (this.textLabels && this.textLabels.length > 0) ||
        hasPrimaryProblem ||
        hasExtraProblems ||
        hasGraphCards ||
        Boolean(this.pdfPageBoardData)
      );
    }

    hasUnsavedWorkToProtect() {
      if (this.hasAnyWorkspaceContent()) return true;
      if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 1) return true;
      if (this.isAudioRecording || this.audioBlob || (Array.isArray(this.audioTimeline) && this.audioTimeline.length > 0)) return true;
      if (this.pdfDoc || (this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0)) return true;
      return false;
    }

    initAccidentalRefreshProtection() {
      if (this._boundRefreshProtection) return;
      this._boundRefreshProtection = true;

      // 1차 방어: 작업 중 실수로 눌린 새로고침 단축키(F5, Ctrl+R, Cmd+R) 즉시 차단!
      window.addEventListener('keydown', (e) => {
        if (!this.hasUnsavedWorkToProtect()) return;
        const isF5 = (e.key === 'F5' || e.code === 'F5');
        const isCtrlOrCmdR = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR');
        if (isF5 || isCtrlOrCmdR) {
          e.preventDefault();
          e.stopPropagation();
          this.showToast('🛡️ 작업 보호: 실수로 인한 새로고침(F5 / Ctrl+R)을 방지했습니다.');
        }
      }, { capture: true });

      // 2차 방어: 브라우저 새로고침 버튼 클릭, 탭 닫기(Ctrl+W / ✕), 뒤로가기 시 브라우저 확인 팝업 표출!
      window.addEventListener('beforeunload', (e) => {
        if (this._isNavigatingForTossPayment) return;
        if (!this.hasUnsavedWorkToProtect()) return;
        e.preventDefault();
        e.returnValue = '';
        return '';
      });
    }

    _archiveCurrentBeforeNextCapture() {
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
        this.lessonPlaylistIndex = 0;
      }
      const nextAppendedIdx = (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0)
        ? 1
        : this.lessonPlaylistSlides.length;
      if (this.isAudioRecording) {
        this._isAudioWaitingForNextSlideSetup = true;
        this._finalizeCurrentSlideAudioSegmentBeforeSwitch(nextAppendedIdx, 0);
      } else if (this._isAudioReplayActive || this.isAudioPlaying) {
        this.stopAudioPlayback(true);
      }
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
        const firstSlide = this.serializeFullSlideState('1');
        this.lessonPlaylistSlides = [firstSlide];
        this.lessonPlaylistIndex = 0;
        this.isLessonPlaylistActive = true;
      } else {
        this.saveCurrentSlideIntoPlaylist();
      }
    }

    _finalizeAppendedCaptureSlide(title = '') {
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
        const firstSlide = this.serializeFullSlideState('1');
        this.lessonPlaylistSlides = [firstSlide];
        this.isLessonPlaylistActive = true;
      }
      const nextIdx = this.lessonPlaylistSlides.length + 1;
      // 새 슬라이드는 이전 슬라이드의 audioSyncData를 물려받지 않도록 초기화 후 직렬화
      this.audioSyncData = null;
      const newSlide = this.serializeFullSlideState(title || String(nextIdx));
      this.lessonPlaylistSlides.push(newSlide);
      this.lessonPlaylistIndex = this.lessonPlaylistSlides.length - 1;
      this._isAudioWaitingForNextSlideSetup = false;
      this._alreadyArchivedBeforePdfModal = false;
      // PDF 모달에서 문제 크롭/페이지 삽입 직후 새 슬라이드 초기 상태가 누락되지 않도록 isPdfModalOpen 선해제
      this.isPdfModalOpen = false;
      if (this._autoPausedByPdfModal) {
        const pausedDelta = this.audioRecordPauseStartMs ? Math.max(0, performance.now() - this.audioRecordPauseStartMs) : 0;
        this.audioRecordTotalPausedMs = (this.audioRecordTotalPausedMs || 0) + pausedDelta;
        this.audioSessionTotalPausedMs = (this.audioSessionTotalPausedMs || 0) + pausedDelta;
        this._autoPausedByPdfModal = false;
        this.isAudioRecordPaused = false;
        this.audioRecordPauseStartMs = 0;
      }
      if (this.isAudioRecording) {
        this._beginNextSlideAudioSegmentAfterSwitch();
      }
      this.syncLessonPlaylistNavBarUI();
    }

    handleNewCanvasButtonClick() {
      this._openSlideChipDelKey = null;
      if (typeof this.canAddMoreSlidesWithQuota === 'function' && !this.canAddMoreSlidesWithQuota(1)) {
        return;
      }
      const wasRecording = Boolean(this.isAudioRecording);
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
        this.lessonPlaylistIndex = 0;
      }
      const nextAppendedIdx = (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0)
        ? 1
        : this.lessonPlaylistSlides.length;
      if (wasRecording) {
        this._isAudioWaitingForNextSlideSetup = true;
        this._finalizeCurrentSlideAudioSegmentBeforeSwitch(nextAppendedIdx, 0);
      } else if (this._isAudioReplayActive || this.isAudioPlaying) {
        this.stopAudioPlayback(true);
      }
      if (!this.isGraphCovered) {
        this.enterBoardMode();
      }

      // 🌟 [슬라이드 저장소 100% 일원화]:
      // 현재 슬라이드가 문제 캡처든, PDF 한 페이지 통째 삽입이든, 백지/그래프든 상관없이
      // 무조건 lessonPlaylistSlides에 현재 슬라이드를 보존하고 깨끗한 다음 번호 캔버스를 추가합니다!
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
        const firstSlide = this.serializeFullSlideState('1');
        this.lessonPlaylistSlides = [firstSlide];
        this.lessonPlaylistIndex = 0;
        this.isLessonPlaylistActive = true;
      } else {
        this.saveCurrentSlideIntoPlaylist();
      }

      this.resetBoardAndProblemCardsForNext();
      this.audioSyncData = null;
      const nextNum = this.lessonPlaylistSlides.length + 1;
      const blankSlide = this.serializeFullSlideState(String(nextNum));
      this.lessonPlaylistSlides.push(blankSlide);
      this.lessonPlaylistIndex = this.lessonPlaylistSlides.length - 1;
      this._isAudioWaitingForNextSlideSetup = false;
      if (wasRecording) {
        this._beginNextSlideAudioSegmentAfterSwitch();
      }
      this.syncLessonPlaylistNavBarUI();
      this.showToast(`✨ 이전 작업을 [${nextNum - 1}번]에 자동 보관하고 깨끗한 [${nextNum}번 캔버스]를 열었습니다!`);
    }

    jumpToPlaylistSlide(targetIdx) {
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides)) return;
      if (targetIdx < 0 || targetIdx >= this.lessonPlaylistSlides.length) return;
      if (targetIdx === this.lessonPlaylistIndex) return;
      const wasRecording = Boolean(this.isAudioRecording);
      const wasPlayingAudio = Boolean(this.isAudioPlaying);
      if (wasRecording) {
        this._finalizeCurrentSlideAudioSegmentBeforeSwitch(targetIdx);
      } else if (this._isAudioReplayActive || this.isAudioPlaying) {
        this.stopAudioPlayback(true);
      }
      this.saveCurrentSlideIntoPlaylist();
      this.lessonPlaylistIndex = targetIdx;
      this.deserializeFullSlideState(this.lessonPlaylistSlides[this.lessonPlaylistIndex]);
      if (wasRecording) {
        this._beginNextSlideAudioSegmentAfterSwitch();
      } else if (wasPlayingAudio && this.audioSyncData && this.audioSyncData.durationMs > 0) {
        this.playAudioSync(0, 'video');
      } else if (this.isStudentAudioVideoOnlyMode && this.audioSyncData && this.audioSyncData.durationMs > 0) {
        this.audioPlayCurrentMs = 0;
        this._lastAppliedAudioStateObj = null;
        this._replayInkBakeKey = '';
        this._isAudioReplayActive = true;
        document.body.classList.add('audio-replay-active');
        if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();
        this._applyAudioTimelineStateAt(0);
        this._renderAudioReplayAtCurrentTime();
        this.syncAudioRecordUI();
      } else if (this.isStudentAudioVideoOnlyMode) {
        this.stopAudioPlayback(true);
        this.exitStudentAudioVideoOnlyMode();
        if (this._viewerPkg) {
          this._viewerPkg.currentIndex = this.lessonPlaylistIndex;
          this.openSmartNoteViewer(this._viewerPkg, true);
        }
        return;
      } else if (typeof this._syncReplayFixedStageLayout === 'function') {
        this._syncReplayFixedStageLayout();
      }
      this.syncLessonPlaylistNavBarUI();
    }

    deletePlaylistSlideAt(delIdx) {
      if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
        this.resetNewCanvas();
        this.showToast('🗑️ 현재 캔버스를 깨끗하게 비웠습니다.');
        return;
      }
      if (delIdx < 0 || delIdx >= this.lessonPlaylistSlides.length) return;

      this.saveCurrentSlideIntoPlaylist();
      this.lessonPlaylistSlides.splice(delIdx, 1);

      if (this.lessonPlaylistSlides.length === 0) {
        this.resetNewCanvas();
        return;
      }

      if (this.lessonPlaylistSlides.length === 1) {
        // 1장만 남아도 상단 캔버스바(1/1 + [+ 다음 페이지] / [다음 캡처])를 그대로 유지하여 즉시 다음 캔버스 추가가 가능하도록 보장!
        this.lessonPlaylistIndex = 0;
        this.isLessonPlaylistActive = true;
        this.deserializeFullSlideState(this.lessonPlaylistSlides[0]);
        this.syncLessonPlaylistNavBarUI();
        this.showToast(`🗑️ [${delIdx + 1}번] 캔버스를 삭제했습니다.`);
        return;
      }

      if (this.lessonPlaylistIndex >= this.lessonPlaylistSlides.length) {
        this.lessonPlaylistIndex = this.lessonPlaylistSlides.length - 1;
      } else if (delIdx < this.lessonPlaylistIndex) {
        this.lessonPlaylistIndex = Math.max(0, this.lessonPlaylistIndex - 1);
      }

      this.deserializeFullSlideState(this.lessonPlaylistSlides[this.lessonPlaylistIndex]);
      this.syncLessonPlaylistNavBarUI();
      this.showToast(`🗑️ [${delIdx + 1}번] 캔버스를 삭제했습니다.`);
    }

    clearCurrentCanvasOnly() {
      if (!this.isDrawerCollapsed && this.activeDrawerPanel === 'panelPresets') {
        document.querySelectorAll('.btn-card-add-func.active').forEach(b => b.classList.remove('active'));
        this._pipTargetCard = 'new';
        this._pipSessionOrigin = 'rail';
        const btnPresets = document.getElementById('btnRailPresets');
        if (btnPresets) btnPresets.classList.add('active');
      } else {
        this._pipTargetCard = null;
        this._pipSessionOrigin = null;
      }
      // 1) PDF 한 페이지 통째 모드인 경우: 현재 PDF 페이지 위에 그린 그래프·보관카드(#1,#2)·문제카드·판서만 싹 비움 (다른 페이지는 보존!)
      if (this.pdfPageBoardData) {
        const hasOnPage = (
          (this.graphs && this.graphs.length > 0) ||
          (this.inkStrokes && this.inkStrokes.length > 0) ||
          (this.dropLines && this.dropLines.length > 0) ||
          (this.textLabels && this.textLabels.length > 0) ||
          Boolean(this._hasPrimaryGraphCard && this.graphCardData) ||
          Boolean(this.extraGraphCards && this.extraGraphCards.length > 0)
        );
        if (!hasOnPage) {
          this.showToast('ℹ️ 현재 페이지에 지울 필기나 그래프가 없습니다.');
          return;
        }
        if (!this.isHistoryProcessing) {
          const fullSnap = this._captureFullWorkspaceSnapshot();
          this.undoStack.push({ type: 'workspace_snapshot', snapshot: fullSnap });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
        this.closeGraphCard();
        if (this.extraGraphCards && this.extraGraphCards.length > 0) {
          this.extraGraphCards.forEach(c => { if (c && c.el) c.el.remove(); });
          this.extraGraphCards = [];
        }
        this._graphCaseCounter = 0;
        this._graphSessionArchived = false;
        this._coveredGraphStateBackup = null;
        this.graphs = [];
        this.activeGraphIdx = -1;
        this.selectedHandleIdx = null;
        this.isCurveSelected = false;
        this.usePiecewise = false;
        this.piecewiseBoundaries = [];
        this.piecewiseFuncMap = [];
        this.piecewiseInclusions = [];
        this.dropLines = [];
        this.textLabels = [];
        this.inkStrokes = [];
        this.selectedInkIndices = [];
        this.inkLassoBox = null;
        this._inkBakeDirty = true;
        this.clearInkCache();
        if (this.isLessonPlaylistActive) {
          this.saveCurrentSlideIntoPlaylist();
        }
        this.syncControls();
        this.renderLayerList();
        this.renderFuncList();
        this.syncGraphSnapBarUI();
        this.render();
        this.showToast('🧹 현재 PDF 페이지의 필기·그래프만 깨끗하게 비웠습니다!');
        return;
      }

      // 2) 다중 슬라이드 묶음(1, 2, 3...) 작업 중인 경우: 다른 슬라이드는 그대로 두고 현재 보고 있는 캔버스 내용만 백지로 비움!
      if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 1) {
        if (!this.hasAnyWorkspaceContent()) {
          this.showToast('ℹ️ 이미 현재 캔버스가 깨끗한 상태입니다.');
          return;
        }
        if (!this.isHistoryProcessing) {
          const fullSnap = this._captureFullWorkspaceSnapshot();
          this.undoStack.push({ type: 'workspace_snapshot', snapshot: fullSnap });
          if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
          this.redoStack = [];
          this.updateUndoRedoUI();
        }
        this.resetBoardAndProblemCardsForNext();
        const curNum = (this.lessonPlaylistIndex || 0) + 1;
        this.lessonPlaylistSlides[this.lessonPlaylistIndex] = this.serializeFullSlideState(String(curNum));
        this.syncLessonPlaylistNavBarUI();
        this.showToast(`🧹 [${curNum}번 캔버스] 내용만 깨끗하게 비웠습니다!`);
        return;
      }

      // 3) 단독 1페이지 작업 중인 경우: 기존 전체 초기화(resetNewCanvas) 실행
      this.resetNewCanvas();
    }

clearAllSlidesAndReset() {
  this._isSlideSelectDeleteMode = false;
  this._selectedSlideDeleteIndices = new Set();
  this.resetNewCanvas();
  this.showToast('🗑️ 모든 캔버스를 비우고 깨끗한 초기 상태로 돌아왔습니다!');
}

handleSmartAddSlideFromTopBar(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  this._isSlideGridOpen = false;
  this._isSlideSelectDeleteMode = false;
  this._selectedSlideDeleteIndices = new Set();

  const hasOpenPdf = Boolean(
    this.pdfDoc ||
    (this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0) ||
    this.lessonTeachingMode === 'crop' ||
    this.lessonTeachingMode === 'page' ||
    this.pdfPageBoardData
  );
  if (hasOpenPdf) {
    this._isAddSlideMenuOpen = !this._isAddSlideMenuOpen;
    this.syncLessonPlaylistNavBarUI();
    return;
  }

  this._isAddSlideMenuOpen = false;
  this.handleNewCanvasButtonClick();
}

toggleSlideGridPopover(forceOpen) {
  this._isAddSlideMenuOpen = false;
  this._isSlideGridOpen = typeof forceOpen === 'boolean' ? forceOpen : !this._isSlideGridOpen;
  this._isSlideSelectDeleteMode = false;
  this._selectedSlideDeleteIndices = new Set();
  this.syncPdfBoardNavBarUI();
  this.syncLessonPlaylistNavBarUI();
}

toggleSlideSelectDeleteMode(forceMode) {
  this._isSlideSelectDeleteMode = typeof forceMode === 'boolean' ? forceMode : !this._isSlideSelectDeleteMode;
  this._selectedSlideDeleteIndices = new Set();
  this.syncLessonPlaylistNavBarUI();
}

deleteSelectedPlaylistSlides() {
  const selectedSet = this._selectedSlideDeleteIndices instanceof Set ? this._selectedSlideDeleteIndices : new Set();
  if (selectedSet.size === 0) {
    this.showToast('⚠️ 삭제할 캔버스 번호를 먼저 선택해 주세요.');
    return;
  }

  if (!this.isLessonPlaylistActive || !Array.isArray(this.lessonPlaylistSlides) || this.lessonPlaylistSlides.length === 0) {
    this._isSlideGridOpen = false;
    this._isSlideSelectDeleteMode = false;
    this._selectedSlideDeleteIndices = new Set();
    this.resetNewCanvas();
    this.showToast('🗑️ 선택한 캔버스를 비우고 초기화했습니다.');
    return;
  }

  this.saveCurrentSlideIntoPlaylist();
  const totalBefore = this.lessonPlaylistSlides.length;
  const validSelected = Array.from(selectedSet)
    .filter(idx => typeof idx === 'number' && idx >= 0 && idx < totalBefore)
    .sort((a, b) => a - b);

  if (validSelected.length === 0) return;

  if (validSelected.length >= totalBefore) {
    this._isSlideGridOpen = false;
    this._isSlideSelectDeleteMode = false;
    this._selectedSlideDeleteIndices = new Set();
    this.clearAllSlidesAndReset();
    return;
  }

  const oldIdx = this.lessonPlaylistIndex || 0;
  let deletedBeforeOld = 0;
  validSelected.forEach(idx => {
    if (idx < oldIdx) deletedBeforeOld++;
  });

  this.lessonPlaylistSlides = this.lessonPlaylistSlides.filter((_, idx) => !selectedSet.has(idx));
  const newIdx = Math.min(this.lessonPlaylistSlides.length - 1, Math.max(0, oldIdx - deletedBeforeOld));
  this.lessonPlaylistIndex = newIdx;
  this.isLessonPlaylistActive = true;
  this._isSlideSelectDeleteMode = false;
  this._selectedSlideDeleteIndices = new Set();

  this.deserializeFullSlideState(this.lessonPlaylistSlides[this.lessonPlaylistIndex]);
  this.syncLessonPlaylistNavBarUI();
  this.showToast(`🗑️ 선택한 ${validSelected.length}개의 캔버스를 삭제했습니다.`);
}

toggleTopSlideBarHidden(hide) {
  this.isTopSlideBarHidden = false;
  this.syncPdfBoardNavBarUI();
  this.syncLessonPlaylistNavBarUI();
}

_syncTopSlideMiniTabUI() {
  const miniTab = document.getElementById('topSlideBarMiniTab');
  if (miniTab) miniTab.style.display = 'none';
}

syncLessonPlaylistNavBarUI() {
  const navBar = document.getElementById('lessonPlaylistNavBar');
  if (!navBar) return;
  this.isTopSlideBarHidden = false;
  const allowInStudentAudio = Boolean(this.isStudentAudioVideoOnlyMode && this.lessonPlaylistSlides && this.lessonPlaylistSlides.length > 1);
  if (this.isStudentAudioVideoOnlyMode && (!this.lessonPlaylistSlides || this.lessonPlaylistSlides.length <= 1)) {
    navBar.style.display = 'none';
    this._syncTopSlideMiniTabUI();
    return;
  }
  if (!this.isGraphCovered && !allowInStudentAudio) {
    navBar.style.display = 'none';
    this._syncTopSlideMiniTabUI();
    return;
  }

  if (!this._boundCloseSlideDelOnOutside) {
    this._boundCloseSlideDelOnOutside = true;
    window.addEventListener('pointerdown', (ev) => {
      if (!this._isSlideGridOpen && !this._isAddSlideMenuOpen && !this._openSlideChipDelKey) return;
      const t = ev.target;
      if (t && t.closest && (t.closest('.slide-grid-popover') || t.closest('.slide-add-menu-popover') || t.closest('#btnPlaylistSlideInfo') || t.closest('#btnPlaylistAddSlide') || t.closest('#btnPdfBoardPageInfo'))) return;
      this._isSlideGridOpen = false;
      this._isAddSlideMenuOpen = false;
      this._isSlideSelectDeleteMode = false;
      this._selectedSlideDeleteIndices = new Set();
      this._openSlideChipDelKey = null;
      this.syncLessonPlaylistNavBarUI();
    }, { capture: true });
  }

  const hasPlaylist = Boolean(this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0);
  const effectiveSlides = hasPlaylist ? this.lessonPlaylistSlides : [null];
  const total = effectiveSlides.length;
  const curIdx = hasPlaylist ? (this.lessonPlaylistIndex || 0) : 0;
  const cur = curIdx + 1;
  const arrowChar = this._isSlideGridOpen ? '▴' : '▾';
  const lbl = document.getElementById('lblPlaylistSlideInfo');
  if (lbl) {
    lbl.textContent = `${cur} / ${total} ${arrowChar}`;
  }

  const gridPop = document.getElementById('playlistGridPopover');
  if (gridPop) {
    gridPop.style.display = this._isSlideGridOpen ? 'flex' : 'none';
  }

  const isSelectMode = Boolean(this._isSlideSelectDeleteMode);
  if (!(this._selectedSlideDeleteIndices instanceof Set)) {
    this._selectedSlideDeleteIndices = new Set();
  }
  const selectedSet = this._selectedSlideDeleteIndices;
  const selCount = selectedSet.size;
  const lblGridTitle = document.getElementById('lblSlideGridPopoverTitle');
  const btnToggleSelect = document.getElementById('btnPlaylistToggleSelectMode');
  const btnClearAll = document.getElementById('btnPlaylistClearAll');
  const btnConfirmDel = document.getElementById('btnPlaylistConfirmSelectedDelete');

  if (lblGridTitle) {
    lblGridTitle.textContent = isSelectMode
      ? (selCount > 0 ? `${selCount}개 선택됨` : '삭제할 번호 선택')
      : '캔버스 목록';
  }
  if (btnToggleSelect) {
    btnToggleSelect.textContent = isSelectMode ? '취소' : '선택';
    btnToggleSelect.classList.toggle('is-select-mode', isSelectMode);
  }
  if (btnClearAll) {
    btnClearAll.style.display = isSelectMode ? 'none' : 'inline-flex';
  }
  if (btnConfirmDel) {
    btnConfirmDel.style.display = isSelectMode ? 'inline-flex' : 'none';
    btnConfirmDel.disabled = (selCount === 0);
    btnConfirmDel.textContent = selCount > 0 ? `삭제 (${selCount})` : '삭제';
  }

  const chipsEl = document.getElementById('playlistSlideChips');
  if (chipsEl) {
    chipsEl.innerHTML = '';
    effectiveSlides.forEach((s, idx) => {
      const isActive = (idx === curIdx);
      const isSelectedForDel = isSelectMode && selectedSet.has(idx);
      const chip = document.createElement('div');
      chip.className = 'slide-chip-item'
        + (isSelectedForDel ? ' selected-for-delete' : (isActive ? ' active' : ''));
      const shortLabel = String(idx + 1);
      chip.title = isSelectMode
        ? (isSelectedForDel ? `${idx + 1}번 삭제 선택 해제` : `${idx + 1}번 삭제 선택`)
        : `${idx + 1}번 캔버스로 이동`;

      const span = document.createElement('span');
      span.className = 'slide-chip-label';
      span.textContent = shortLabel;
      chip.appendChild(span);

      chip.onclick = (e) => {
        e.stopPropagation();
        if (this._isSlideSelectDeleteMode) {
          if (selectedSet.has(idx)) {
            selectedSet.delete(idx);
          } else {
            selectedSet.add(idx);
          }
          this.syncLessonPlaylistNavBarUI();
          return;
        }
        this._isSlideGridOpen = false;
        if (hasPlaylist && idx !== this.lessonPlaylistIndex) {
          this.jumpToPlaylistSlide(idx);
        } else {
          this.syncLessonPlaylistNavBarUI();
        }
      };
      chipsEl.appendChild(chip);
    });
  }

  const btnPrev = document.getElementById('btnPlaylistPrev');
  const btnNext = document.getElementById('btnPlaylistNext');
  const btnNextPdfPage = document.getElementById('btnPlaylistNextPdfPage');
  const btnOpenPdf = document.getElementById('btnPlaylistOpenPdf');
  const btnAddSlide = document.getElementById('btnPlaylistAddSlide');
  const addMenuPop = document.getElementById('playlistAddSlideMenu');
  const lblMenuNextPdfPage = document.getElementById('lblAddSlideMenuNextPdfPage');
  if (btnPrev) btnPrev.disabled = (curIdx <= 0);
  if (btnNext) btnNext.disabled = (curIdx >= total - 1);
  if (btnNextPdfPage) btnNextPdfPage.style.display = 'none';
  if (btnOpenPdf) btnOpenPdf.style.display = 'none';

  const hasOpenPdf = Boolean(
    this.pdfDoc ||
    (this._cachedPdfBytes && this._cachedPdfBytes.byteLength > 0) ||
    this.lessonTeachingMode === 'crop' ||
    this.lessonTeachingMode === 'page' ||
    this.pdfPageBoardData
  );
  const isPdfPageMode = Boolean(
    this.pdfPageBoardData ||
    (this.lessonTeachingMode === 'page' && !this.hasActiveProblemCard())
  );
  if (!hasOpenPdf) {
    this._isAddSlideMenuOpen = false;
  }
  if (addMenuPop) {
    addMenuPop.style.display = (this._isAddSlideMenuOpen && hasOpenPdf) ? 'flex' : 'none';
  }
  const btnMenuNextPdfPage = document.getElementById('btnAddSlideMenuNextPdfPage');
  const iconMenuPickPdf = document.getElementById('iconAddSlideMenuPickPdf');
  const lblMenuPickPdf = document.getElementById('lblAddSlideMenuPickPdf');
  if (btnMenuNextPdfPage) {
    btnMenuNextPdfPage.style.display = isPdfPageMode ? 'flex' : 'none';
  }
  if (lblMenuNextPdfPage) {
    lblMenuNextPdfPage.textContent = '다음 페이지';
  }
  if (iconMenuPickPdf) {
    iconMenuPickPdf.textContent = isPdfPageMode ? '🔍' : '✂️';
  }
  if (lblMenuPickPdf) {
    lblMenuPickPdf.textContent = isPdfPageMode ? '페이지 선택' : '다음 캡처';
  }
  if (btnAddSlide) {
    btnAddSlide.title = hasOpenPdf
      ? (isPdfPageMode ? '캔버스 추가 메뉴 (다음 페이지 / 페이지 선택 / 빈 캔버스)' : '캔버스 추가 메뉴 (다음 캡처 / 빈 캔버스)')
      : '새 빈 캔버스 추가';
  }

  navBar.style.display = 'flex';
  this._syncTopSlideMiniTabUI();
}

// ============================================================================
// 🔗 [학생용/강사용 판서 페이지 + #1,#2 그래프 카드 + 전체 슬라이드 통째 클라우드 링크 생성/복원]
// ============================================================================
_getActiveSlidesForExport(fallbackTitle = '공유된 수업 노트') {
  const ensurePdfDataUrls = (slides) => {
    if (!Array.isArray(slides)) return slides;
    slides.forEach(s => {
      if (s && s.pdfPageBoardData && !s.pdfPageBoardData.dataUrl) {
        const cv = (s.pdfPageBoardData.canvas && !s.pdfPageBoardData.canvas._evicted && s.pdfPageBoardData.canvas.width > 4)
          ? s.pdfPageBoardData.canvas
          : ((typeof this._getPdfPageCanvasFromCache === 'function')
            ? this._getPdfPageCanvasFromCache(s.pdfPageBoardData.pageNum, '')
            : null);
        if (cv) {
          s.pdfPageBoardData.dataUrl = cv._cachedDataUrl || (cv._cachedDataUrl = this.encodeCanvasSmartWebP(cv, 0.78));
        }
      }
      if (s && s.audioSyncData) {
        s.audioSyncData = this._compactAudioSyncData(s.audioSyncData);
      }
    });
    return slides;
  };
  if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
    if (!this._isCapturingExportSnapshots) {
      this.saveCurrentSlideIntoPlaylist();
    }
    ensurePdfDataUrls(this.lessonPlaylistSlides);
    return JSON.parse(JSON.stringify(this.lessonPlaylistSlides));
  }
  if (this._isCapturingExportSnapshots && this._exportSnapshotLoopBackupCurrent) {
    ensurePdfDataUrls([this._exportSnapshotLoopBackupCurrent]);
    return [JSON.parse(JSON.stringify(this._exportSnapshotLoopBackupCurrent))];
  }
  const singleSlide = this.serializeFullSlideState(fallbackTitle);
  ensurePdfDataUrls([singleSlide]);
  return [JSON.parse(JSON.stringify(singleSlide))];
}

_applyExportFilterToSlideData(rawSlide, filterOpts = null) {
  const slide = JSON.parse(JSON.stringify(rawSlide));
  if (!filterOpts) return slide;
  const incProb = filterOpts.includeProblem !== false;
  const incGraph = filterOpts.includeGraph !== false;
  const incInk = filterOpts.includeInk !== false;
  const incAudio = filterOpts.includeAudio !== false;

  if (!incProb || !incGraph || !incInk) {
    delete slide.viewerSnapshotDataUrl;
    delete slide._viewerHiResRendered;
  }

  if (!incProb) {
    slide.primaryProblemCard = null;
    slide.extraProblems = [];
    slide.pdfPageBoardData = null;
  } else if (!incInk) {
    if (slide.primaryProblemCard) {
      slide.primaryProblemCard.problemInkStrokes = [];
    }
    if (Array.isArray(slide.extraProblems)) {
      slide.extraProblems.forEach(ep => {
        if (ep) {
          ep.problemInkStrokes = [];
          ep.cardInkStrokes = [];
        }
      });
    }
  }

  const stripGraphSnapshotInk = (snapVal) => {
    if (!snapVal) return snapVal;
    if (typeof snapVal === 'object') {
      snapVal.graphInkStrokes = [];
      return snapVal;
    }
    if (typeof snapVal === 'string') {
      try {
        const parsed = JSON.parse(snapVal);
        if (parsed && typeof parsed === 'object') {
          parsed.graphInkStrokes = [];
          return JSON.stringify(parsed);
        }
      } catch (e) { }
    }
    return snapVal;
  };

  if (!incGraph) {
    slide.primaryGraphCard = null;
    slide.extraGraphs = [];
    slide.coveredGraphStateBackup = null;
  } else if (!incInk) {
    if (slide.primaryGraphCard) {
      slide.primaryGraphCard.graphInkStrokes = [];
      if (slide.primaryGraphCard.primaryGraphCardSnapshot) {
        slide.primaryGraphCard.primaryGraphCardSnapshot = stripGraphSnapshotInk(slide.primaryGraphCard.primaryGraphCardSnapshot);
      }
      if (slide.primaryGraphCard.graphCardData && slide.primaryGraphCard.graphCardData.graphSnapshot) {
        slide.primaryGraphCard.graphCardData.graphSnapshot = stripGraphSnapshotInk(slide.primaryGraphCard.graphCardData.graphSnapshot);
      }
    }
    if (Array.isArray(slide.extraGraphs)) {
      slide.extraGraphs.forEach(eg => {
        if (eg) {
          eg.graphInkStrokes = [];
          eg.cardInkStrokes = [];
          if (eg.graphSnapshot) {
            eg.graphSnapshot = stripGraphSnapshotInk(eg.graphSnapshot);
          }
        }
      });
    }
  }

  if (!incAudio) {
    slide.audioSyncData = null;
  } else if (slide.audioSyncData && (!incInk || !incProb || !incGraph)) {
    slide.audioSyncData = this._applyExportFilterToAudioSyncData(slide.audioSyncData, {
      includeProblem: incProb,
      includeGraph: incGraph,
      includeInk: incInk
    });
  }

  if (slide.historyJson) {
    try {
      const hObj = typeof slide.historyJson === 'string' ? JSON.parse(slide.historyJson) : slide.historyJson;
      if (!incInk) {
        hObj.inkStrokes = [];
      }
      if (!incGraph) {
        hObj.graphs = [];
        hObj.dropLines = [];
        hObj.textLabels = [];
        hObj.usePiecewise = false;
      } else if (!incProb && !incInk && slide.isGraphCovered && !slide.primaryGraphCard && (!slide.extraGraphs || slide.extraGraphs.length === 0)) {
        // 그래프만 내보내기할 때 칠판 판서 모드로 덮여 있던 실시간 그래프가 있으면 자동으로 꺼내서 복원
        if ((!hObj.graphs || hObj.graphs.length === 0) && slide.coveredGraphStateBackup && Array.isArray(slide.coveredGraphStateBackup.graphs) && slide.coveredGraphStateBackup.graphs.length > 0) {
          hObj.graphs = JSON.parse(JSON.stringify(slide.coveredGraphStateBackup.graphs));
        }
        slide.isGraphCovered = false;
      }
      slide.historyJson = hObj;
    } catch (e) { }
  }
  return slide;
}

_applyExportFilterToAudioSyncData(rawAudioSync, filterOpts = null) {
  if (!rawAudioSync || !filterOpts) return rawAudioSync;
  const incProb = filterOpts.includeProblem !== false;
  const incGraph = filterOpts.includeGraph !== false;
  const incInk = filterOpts.includeInk !== false;
  if (incProb && incGraph && incInk) return rawAudioSync;

  if (rawAudioSync._isLazyAudioStub) return rawAudioSync;
  const wasCompact = Boolean(rawAudioSync._compact);
  const expanded = (typeof this._expandAudioSyncData === 'function')
    ? this._expandAudioSyncData(rawAudioSync)
    : JSON.parse(JSON.stringify(rawAudioSync));

  const sanitizeKeyframe = (kf) => {
    if (!kf || typeof kf !== 'object') return kf;
    if (!incInk) {
      if (kf.graphCardPipSnap && typeof kf.graphCardPipSnap === 'object') {
        kf.graphCardPipSnap.graphInkStrokes = [];
      }
      if (kf.graphCardSnap && typeof kf.graphCardSnap === 'object') {
        kf.graphCardSnap.graphInkStrokes = [];
      }
      if (Array.isArray(kf.extraGraphStates)) {
        kf.extraGraphStates.forEach((st) => {
          if (st && st.pipSnap && typeof st.pipSnap === 'object') {
            st.pipSnap.graphInkStrokes = [];
          }
        });
      }
    }
    if (!incProb) {
      kf.probCardVisible = false;
      kf.extraProbsCount = 0;
      kf.extraProbStates = [];
      kf.problemCardStickers = [];
    }
    if (!incGraph) {
      kf.graphs = [];
      kf.dropLines = [];
      kf.textLabels = [];
      kf.usePiecewise = false;
      kf.piecewiseBoundaries = [];
      kf.graphCardVisible = false;
      kf.graphCardPipSnap = null;
      kf.graphCardSnap = null;
      kf.extraGraphsCount = 0;
      kf.extraGraphStates = [];
      kf.graphCardStickers = [];
    }
    return kf;
  };

  if (expanded.initialState) sanitizeKeyframe(expanded.initialState);
  if (expanded.finalState) sanitizeKeyframe(expanded.finalState);
  if (Array.isArray(expanded.keyframes)) {
    expanded.keyframes.forEach((kf) => sanitizeKeyframe(kf));
  }
  if (Array.isArray(expanded.timeline)) {
    expanded.timeline.forEach((ev) => {
      if (!ev) return;
      if (ev.type === 'state' && ev.state) {
        sanitizeKeyframe(ev.state);
      } else if (ev.type === 'cursor' && !incInk) {
        ev.isDrawing = false;
      }
    });
  }

  if (!incInk) {
    expanded.laserStrokes = [];
    expanded.erasedStrokes = [];
  } else if (Array.isArray(expanded.erasedStrokes)) {
    expanded.erasedStrokes = expanded.erasedStrokes.filter((entry) => {
      if (!entry) return false;
      const tgt = String(entry.target || '');
      const ck = String(entry.cardKey || '');
      if (!incProb && (tgt === 'problem' || ck.startsWith('problem'))) return false;
      if (!incGraph && (tgt === 'graph' || ck.startsWith('graph'))) return false;
      return true;
    });
  }

  return (wasCompact && typeof this._compactAudioSyncData === 'function')
    ? this._compactAudioSyncData(expanded)
    : expanded;
}

_getFilteredSlidesForExport(fallbackTitle = '공유된 수업 노트', scope = 'current', filterOpts = null) {
  const effScope = scope || this.exportScope || 'current';
  const effFilter = filterOpts || this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
  let slides = [];
  if (effScope === 'all') {
    slides = this._getActiveSlidesForExport(fallbackTitle);
  } else if (this._isCapturingExportSnapshots && this._exportSnapshotLoopBackupCurrent) {
    slides = [JSON.parse(JSON.stringify(this._exportSnapshotLoopBackupCurrent))];
  } else {
    const curPlaylistSlide = (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides[this.lessonPlaylistIndex])
      ? this.lessonPlaylistSlides[this.lessonPlaylistIndex]
      : null;
    const effTitle = (curPlaylistSlide && curPlaylistSlide.slideTitle) ? curPlaylistSlide.slideTitle : fallbackTitle;
    slides = [this.serializeFullSlideState(effTitle)];
  }
  return slides.map(s => this._applyExportFilterToSlideData(s, effFilter));
}

  async _waitForSlideImagesReady() {
  if (this.pdfPageBoardData && (!this.pdfPageBoardData.canvas || this.pdfPageBoardData.canvas._evicted || this.pdfPageBoardData.canvas.width <= 4) && this.pdfPageBoardData.dataUrl) {
    if (typeof this._ensurePdfBoardCanvasFromDataUrl === 'function') {
      await this._ensurePdfBoardCanvasFromDataUrl(this.pdfPageBoardData);
    }
  }
  const imgs = Array.from(document.querySelectorAll(
    '#problemCardImg, #graphCardImg, .extra-problem-card-widget .problem-card-img, .extra-graph-card-widget .problem-card-img'
  ));
  if (this.pdfPageBoardData && this.pdfPageBoardData.img) {
    imgs.push(this.pdfPageBoardData.img);
  }
  await Promise.all(imgs.map(img => {
    const attrSrc = img && typeof img.getAttribute === 'function' ? img.getAttribute('src') : '';
    if (!img || !attrSrc || !img.src) return Promise.resolve();
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => { });
    }
    return new Promise(res => {
      img.onload = () => res();
      img.onerror = () => res();
      setTimeout(res, 120);
    });
  }));
  this.syncProblemCardRectFromWidget();
  this.renderProblemCardCanvas();
  this.syncGraphCardRectFromWidget();
  this.renderGraphCardCanvas();
  if (this.pdfPageBoardData && this.pdfPageBoardData.img && (!this.pdfPageBoardData.canvas || this.pdfPageBoardData.canvas._evicted || this.pdfPageBoardData.canvas.width <= 4) && this.pdfPageBoardData.img.naturalWidth > 0) {
    const offC = document.createElement('canvas');
    offC.width = this.pdfPageBoardData.img.naturalWidth;
    offC.height = this.pdfPageBoardData.img.naturalHeight;
    offC.getContext('2d').drawImage(this.pdfPageBoardData.img, 0, 0);
    this.pdfPageBoardData.canvas = offC;
  }
}

captureCurrentSlideViewerSnapshot(filterOpts = null, forCloud = false) {
  const effFilter = filterOpts || this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true };
  const smartBounds = this.getSmartExportBounds(effFilter);
  const hotspots = this.extractGraphHotspotsForBounds(smartBounds, effFilter);
  const stickerHotspots = this.extractStickerHotspotsForBounds(smartBounds, effFilter);
  this._omitStickersForViewerSnapshot = true;
  const isMobileDevice = (typeof window !== 'undefined') && (window.innerWidth <= 768 || window.innerHeight <= 500);
  const targetScale = isMobileDevice ? 1.8 : (forCloud ? 2.2 : 2.8);
  let exp;
  try {
    exp = this.getExportCanvas(effFilter, smartBounds, targetScale);
  } finally {
    this._omitStickersForViewerSnapshot = false;
  }
  let dataUrl = '';
  try {
    const allowJpeg = !this.exportTransparent;
    dataUrl = (forCloud || isMobileDevice)
      ? this.encodeCanvasSmartWebP(exp.canvas, 0.80, allowJpeg)
      : exp.canvas.toDataURL('image/png');
  } catch (e) {
    dataUrl = exp.canvas.toDataURL('image/png');
  }
  return {
    canvas: exp.canvas,
    width: exp.width,
    height: exp.height,
    dpi: exp.dpi,
    dataUrl,
    hotspots,
    stickerHotspots,
    smartBounds
  };
}

// ============================================================================
// 💎 [Premium 전용 뷰어 상단 강사·학원 홍보배너 빌더 & 스마트 뷰어 렌더링 엔진]
// ============================================================================
_getDefaultPromoBannerConfig() {
  return {
    enabled: false,
    theme: 'slate',
    badgeText: '',
    messageText: '',
    ctaLabel: '',
    ctaUrl: ''
  };
}

_cleanSingleLinePromoText(val, maxLen = 50) {
  if (val == null) return '';
  return String(val)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

_normalizeSafePromoUrl(rawUrl) {
  const trimmed = String(rawUrl == null ? '' : rawUrl)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  if (!trimmed) return { ok: true, url: '' };
  if (trimmed.length > 350 || /[<>"'\s]/.test(trimmed)) {
    return { ok: false, url: '' };
  }
  if (/^(javascript|data|vbscript|file|blob|about):/i.test(trimmed)) {
    return { ok: false, url: '' };
  }
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
      return { ok: false, url: '' };
    }
    candidate = 'https://' + candidate.replace(/^\/+/, '');
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, url: '' };
    }
    const host = String(parsed.hostname || '').toLowerCase();
    if (!host || (!host.includes('.') && host !== 'localhost' && host !== '127.0.0.1')) {
      return { ok: false, url: '' };
    }
    return { ok: true, url: parsed.href };
  } catch (e) {
    return { ok: false, url: '' };
  }
}

_sanitizePromoBannerConfig(raw) {
  const base = this._getDefaultPromoBannerConfig();
  if (!raw || typeof raw !== 'object') return base;
  const validThemes = ['slate', 'royal', 'violet', 'emerald', 'amber'];
  const theme = validThemes.includes(String(raw.theme || '')) ? String(raw.theme) : 'slate';
  const badgeText = this._cleanSingleLinePromoText(raw.badgeText, 24);
  const messageText = this._cleanSingleLinePromoText(raw.messageText, 52);
  const ctaLabel = this._cleanSingleLinePromoText(raw.ctaLabel, 14);
  const urlCheck = this._normalizeSafePromoUrl(raw.ctaUrl);
  return {
    enabled: Boolean(raw.enabled),
    theme,
    badgeText,
    messageText,
    ctaLabel,
    ctaUrl: urlCheck.ok ? urlCheck.url : ''
  };
}

_getPromoBannerStorageKey(uid = null) {
  const targetUid = uid || ((this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest');
  return `graphly_promo_banner_v1_${targetUid}`;
}

_loadPromoBannerConfigForCurrentUser() {
  let loaded = this._getDefaultPromoBannerConfig();
  try {
    const raw = localStorage.getItem(this._getPromoBannerStorageKey());
    if (raw) {
      loaded = this._sanitizePromoBannerConfig(JSON.parse(raw));
    }
  } catch (e) { }
  this.promoBannerConfig = loaded;
  if (typeof this.syncPromoBannerEntryButtonsUI === 'function') {
    this.syncPromoBannerEntryButtonsUI();
  }
  return this.promoBannerConfig;
}

_savePromoBannerConfigForCurrentUser(cfg, syncCloud = true) {
  const clean = this._sanitizePromoBannerConfig(cfg);
  this.promoBannerConfig = clean;
  try {
    localStorage.setItem(this._getPromoBannerStorageKey(), JSON.stringify(clean));
  } catch (e) { }
  if (syncCloud && typeof this.scheduleSaveUserPreferences === 'function') {
    this.scheduleSaveUserPreferences();
  }
  if (typeof this.syncPromoBannerEntryButtonsUI === 'function') {
    this.syncPromoBannerEntryButtonsUI();
  }
  if (typeof this._invalidateShareModalLinkCache === 'function') {
    this._invalidateShareModalLinkCache();
  }
  return clean;
}

getPromoBannerConfig() {
  if (!this.promoBannerConfig || typeof this.promoBannerConfig !== 'object') {
    return this._loadPromoBannerConfigForCurrentUser();
  }
  return this._sanitizePromoBannerConfig(this.promoBannerConfig);
}

getEffectiveSharePromoBanner() {
  if (!this.cloudUser || !this.cloudUser.uid) return null;
  const quota = typeof this.getCurrentTierQuota === 'function' ? this.getCurrentTierQuota() : null;
  if (!quota || quota.tier !== 'premium' || !quota.isPermanentShare) return null;
  const cfg = this.getPromoBannerConfig();
  if (!cfg.enabled) return null;
  if (!cfg.badgeText && !cfg.messageText) return null;
  return {
    enabled: true,
    theme: cfg.theme,
    badgeText: cfg.badgeText,
    messageText: cfg.messageText,
    ctaLabel: cfg.ctaUrl ? (cfg.ctaLabel || '바로가기') : '',
    ctaUrl: cfg.ctaUrl || ''
  };
}

_getPromoBannerSignature() {
  const eff = this.getEffectiveSharePromoBanner();
  if (!eff) return 'nopromo';
  return `${eff.theme}|${eff.badgeText}|${eff.messageText}|${eff.ctaLabel}|${eff.ctaUrl}`;
}

_getValidViewerPromoBanner(pkg) {
  if (!pkg || !pkg.promoBanner || typeof pkg.promoBanner !== 'object') return null;
  if (pkg.promoBanner.enabled === false) return null;

  const isLocalPreview = Boolean(pkg._isLocalPreview === true);
  const isPermShare = Boolean(pkg.isPermanentShare || pkg._topIsPermanentShare || pkg.expiresAt === 0);
  const isPremiumTierShare = Boolean(pkg.shareTier === 'premium');
  if (!isLocalPreview && !isPermShare && !isPremiumTierShare) return null;

  if (!isLocalPreview && isPermShare) {
    const hasTop = Boolean(pkg._hasTopPremiumActiveUntil || pkg._topPremiumActiveUntil !== undefined);
    const premUntil = hasTop
      ? (Number(pkg._topPremiumActiveUntil) || 0)
      : (Number(pkg.premiumActiveUntil) || 0);
    const cfg = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
    const graceDays = (cfg && Number(cfg.premiumShareGraceDays)) || 7;
    const graceMs = graceDays * 24 * 60 * 60 * 1000;
    if ((hasTop && premUntil <= 0) || (premUntil > 0 && Date.now() > (premUntil + graceMs))) {
      return null;
    }
  }

  const clean = this._sanitizePromoBannerConfig(pkg.promoBanner);
  if (!clean.badgeText && !clean.messageText) return null;
  return clean;
}

_renderPromoBannerPillDOM(banner, variant = 'header') {
  const clean = this._sanitizePromoBannerConfig(banner);
  const pill = document.createElement('div');
  pill.className = `viewer-promo-banner-pill theme-${clean.theme}` + (variant === 'gate' ? ' is-gate-banner' : '');

  if (variant === 'gate' || variant === 'header') {
    pill.addEventListener('pointerdown', (e) => e.stopPropagation());
    pill.addEventListener('click', (e) => e.stopPropagation());
  }

  const hasBadge = Boolean(clean.badgeText);
  const hasMsg = Boolean(clean.messageText);

  if (hasBadge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'viewer-promo-badge';
    badgeEl.textContent = clean.badgeText;
    pill.appendChild(badgeEl);
  }

  if (hasMsg || !hasBadge) {
    const msgEl = document.createElement('span');
    msgEl.className = 'viewer-promo-msg';
    msgEl.textContent = hasMsg ? clean.messageText : '우리 학원·선생님 한 줄 홍보 문구가 여기에 표시됩니다';
    pill.appendChild(msgEl);
  }

  if (clean.ctaUrl) {
    const ctaLink = document.createElement('a');
    ctaLink.className = 'viewer-promo-cta-btn';
    ctaLink.href = clean.ctaUrl;
    ctaLink.target = '_blank';
    ctaLink.rel = 'noopener noreferrer nofollow';
    ctaLink.textContent = `${clean.ctaLabel || '바로가기'} ↗`;
    ctaLink.addEventListener('pointerdown', (e) => e.stopPropagation());
    ctaLink.addEventListener('click', (e) => e.stopPropagation());
    pill.appendChild(ctaLink);
  }

  return pill;
}

syncPromoBannerEntryButtonsUI() {
  const badgeSettings = document.getElementById('badgeSettingsPromoStatus');
  const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
  const tier = isLoggedIn && typeof this.getUserSubscriptionTier === 'function'
    ? this.getUserSubscriptionTier()
    : 'free';
  const cfg = this.getPromoBannerConfig();
  const hasContent = Boolean(cfg.badgeText || cfg.messageText);

  if (badgeSettings) {
    badgeSettings.classList.remove('is-on', 'is-off');
    if (isLoggedIn && tier === 'premium') {
      if (cfg.enabled && hasContent) {
        badgeSettings.textContent = '켜짐 ON';
        badgeSettings.classList.add('is-on');
      } else {
        badgeSettings.textContent = hasContent ? '꺼짐 OFF' : '설정하기';
        badgeSettings.classList.add('is-off');
      }
    } else {
      badgeSettings.textContent = '💎 Premium';
    }
  }

  this.syncShareModalPromoBannerUI();
}

syncShareModalPromoBannerUI() {
  const lblSummary = document.getElementById('lblSharePromoSummary');
  const wrapToggle = document.getElementById('wrapShareQuickPromoToggle');
  const chkToggle = document.getElementById('chkShareQuickPromoToggle');
  const btnOpen = document.getElementById('btnOpenPromoBannerFromShare');
  if (!lblSummary && !btnOpen) return;

  const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
  const tier = isLoggedIn && typeof this.getUserSubscriptionTier === 'function'
    ? this.getUserSubscriptionTier()
    : 'free';
  const cfg = this.getPromoBannerConfig();
  const hasContent = Boolean(cfg.badgeText || cfg.messageText);

  if (isLoggedIn && tier === 'premium') {
    if (wrapToggle) wrapToggle.style.display = hasContent ? 'inline-flex' : 'none';
    if (chkToggle) chkToggle.checked = Boolean(cfg.enabled && hasContent);
    if (lblSummary) {
      if (!hasContent) {
        lblSummary.textContent = '홍보배너 · 문구를 설정해 보세요';
      } else {
        const previewTitle = [cfg.badgeText, cfg.messageText].filter(Boolean).join(' · ');
        lblSummary.textContent = `${cfg.enabled ? '홍보배너 ON' : '홍보배너 OFF'} · ${previewTitle}`;
      }
    }
    if (btnOpen) {
      btnOpen.textContent = hasContent ? '설정' : '+ 배너 작성';
    }
  } else {
    if (wrapToggle) wrapToggle.style.display = 'none';
    if (lblSummary) {
      lblSummary.textContent = '뷰어 상단 학원·선생님 홍보배너 (💎 Premium)';
    }
    if (btnOpen) {
      btnOpen.textContent = '미리보기 ▸';
    }
  }
}

_collectDraftPromoBannerFromModal() {
  const chkEnabled = document.getElementById('chkPromoBannerEnabled');
  const inpBadge = document.getElementById('inputPromoBadgeText');
  const inpMsg = document.getElementById('inputPromoMessageText');
  const inpCtaLabel = document.getElementById('inputPromoCtaLabel');
  const inpCtaUrl = document.getElementById('inputPromoCtaUrl');
  const rawUrl = inpCtaUrl ? inpCtaUrl.value : '';
  const urlCheck = this._normalizeSafePromoUrl(rawUrl);
  return {
    draft: {
      enabled: chkEnabled ? Boolean(chkEnabled.checked) : true,
      theme: this._draftPromoTheme || 'slate',
      badgeText: this._cleanSingleLinePromoText(inpBadge ? inpBadge.value : '', 24),
      messageText: this._cleanSingleLinePromoText(inpMsg ? inpMsg.value : '', 52),
      ctaLabel: this._cleanSingleLinePromoText(inpCtaLabel ? inpCtaLabel.value : '', 14),
      ctaUrl: urlCheck.ok ? urlCheck.url : ''
    },
    rawUrl: String(rawUrl || '').trim(),
    urlValid: urlCheck.ok
  };
}

renderPromoBannerLivePreview() {
  const mount = document.getElementById('promoBannerLivePreviewMount');
  if (!mount) return;
  const { draft } = this._collectDraftPromoBannerFromModal();
  const sampleBanner = {
    enabled: true,
    theme: draft.theme || 'slate',
    badgeText: draft.badgeText || (!draft.messageText ? '대치 OO수학 · 김수학T' : ''),
    messageText: draft.messageText || (!draft.badgeText ? '겨울방학 미적분 특강 개강 · 상시 질의응답' : ''),
    ctaLabel: draft.ctaUrl ? (draft.ctaLabel || '바로가기') : (draft.ctaLabel || (!draft.badgeText && !draft.messageText ? '상담·블로그' : '')),
    ctaUrl: draft.ctaUrl || (!draft.badgeText && !draft.messageText ? 'https://graphly.net' : '')
  };
  mount.innerHTML = '';
  mount.classList.toggle('is-disabled-preview', !draft.enabled);
  mount.appendChild(this._renderPromoBannerPillDOM(sampleBanner, 'preview'));
}

syncPromoBannerSettingsModalUI() {
  const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
  const tier = isLoggedIn && typeof this.getUserSubscriptionTier === 'function'
    ? this.getUserSubscriptionTier()
    : 'free';
  const isPremium = Boolean(isLoggedIn && tier === 'premium');

  const upsellNotice = document.getElementById('promoBannerUpsellNotice');
  const btnSave = document.getElementById('btnSavePromoBannerModal');
  if (upsellNotice) {
    upsellNotice.style.display = isPremium ? 'none' : 'block';
  }
  if (btnSave) {
    btnSave.textContent = isPremium ? '💾 배너 설정 저장' : '💎 Premium 업그레이드하고 적용하기';
    btnSave.classList.toggle('is-upsell-btn', !isPremium);
  }

  const themeChips = document.querySelectorAll('#promoThemeChips .promo-theme-chip');
  themeChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.promoTheme === (this._draftPromoTheme || 'slate'));
  });

  this.renderPromoBannerLivePreview();
}

openPromoBannerSettingsModal() {
  const modal = document.getElementById('modalPromoBannerSettings');
  if (!modal) return;

  const cfg = this.getPromoBannerConfig();
  const hasExisting = Boolean(cfg.badgeText || cfg.messageText || cfg.ctaUrl);
  this._draftPromoTheme = cfg.theme || 'slate';

  const chkEnabled = document.getElementById('chkPromoBannerEnabled');
  const inpBadge = document.getElementById('inputPromoBadgeText');
  const inpMsg = document.getElementById('inputPromoMessageText');
  const inpCtaLabel = document.getElementById('inputPromoCtaLabel');
  const inpCtaUrl = document.getElementById('inputPromoCtaUrl');

  if (chkEnabled) chkEnabled.checked = hasExisting ? Boolean(cfg.enabled) : true;
  if (inpBadge) inpBadge.value = cfg.badgeText || '';
  if (inpMsg) inpMsg.value = cfg.messageText || '';
  if (inpCtaLabel) inpCtaLabel.value = cfg.ctaLabel || '';
  if (inpCtaUrl) inpCtaUrl.value = cfg.ctaUrl || '';

  this.syncPromoBannerSettingsModalUI();
  modal.classList.add('show');
}

initPromoBannerModalEvents() {
  if (this._promoBannerEventsBound) return;
  this._promoBannerEventsBound = true;

  const modal = document.getElementById('modalPromoBannerSettings');
  const btnOpenSettings = document.getElementById('btnOpenPromoBannerFromSettings');
  const btnOpenShare = document.getElementById('btnOpenPromoBannerFromShare');
  const chkQuickShare = document.getElementById('chkShareQuickPromoToggle');
  const btnClose = document.getElementById('btnClosePromoBannerModal');
  const btnCancel = document.getElementById('btnCancelPromoBannerModal');
  const btnReset = document.getElementById('btnResetPromoBannerDraft');
  const btnSave = document.getElementById('btnSavePromoBannerModal');
  const chkEnabled = document.getElementById('chkPromoBannerEnabled');
  const inpBadge = document.getElementById('inputPromoBadgeText');
  const inpMsg = document.getElementById('inputPromoMessageText');
  const inpCtaLabel = document.getElementById('inputPromoCtaLabel');
  const inpCtaUrl = document.getElementById('inputPromoCtaUrl');

  if (btnOpenSettings) {
    btnOpenSettings.onclick = () => this.openPromoBannerSettingsModal();
  }
  if (btnOpenShare) {
    btnOpenShare.onclick = () => this.openPromoBannerSettingsModal();
  }
  if (chkQuickShare) {
    chkQuickShare.onchange = () => {
      const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
      const tier = isLoggedIn && typeof this.getUserSubscriptionTier === 'function'
        ? this.getUserSubscriptionTier()
        : 'free';
      if (!isLoggedIn || tier !== 'premium') {
        chkQuickShare.checked = false;
        this.openPromoBannerSettingsModal();
        return;
      }
      const cur = this.getPromoBannerConfig();
      if (!cur.badgeText && !cur.messageText) {
        chkQuickShare.checked = false;
        this.openPromoBannerSettingsModal();
        return;
      }
      cur.enabled = Boolean(chkQuickShare.checked);
      this._savePromoBannerConfigForCurrentUser(cur, true);
      this.showToast(cur.enabled ? '📢 공유 링크 홍보배너가 켜졌습니다.' : '🔕 공유 링크 홍보배너가 꺼졌습니다.');
    };
  }

  const closeModal = () => {
    if (modal) modal.classList.remove('show');
  };
  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.querySelectorAll('#promoThemeChips .promo-theme-chip').forEach((chip) => {
    chip.onclick = () => {
      this._draftPromoTheme = chip.dataset.promoTheme || 'slate';
      this.syncPromoBannerSettingsModalUI();
    };
  });

  [chkEnabled, inpBadge, inpMsg, inpCtaLabel, inpCtaUrl].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => this.renderPromoBannerLivePreview());
    el.addEventListener('change', () => this.renderPromoBannerLivePreview());
  });

  if (btnReset) {
    btnReset.onclick = () => {
      this._draftPromoTheme = 'slate';
      if (chkEnabled) chkEnabled.checked = false;
      if (inpBadge) inpBadge.value = '';
      if (inpMsg) inpMsg.value = '';
      if (inpCtaLabel) inpCtaLabel.value = '';
      if (inpCtaUrl) inpCtaUrl.value = '';
      this.syncPromoBannerSettingsModalUI();
    };
  }

  if (btnSave) {
    btnSave.onclick = () => {
      const { draft, rawUrl, urlValid } = this._collectDraftPromoBannerFromModal();
      if (rawUrl && !urlValid) {
        this.showToast('⚠️ 올바른 인터넷 주소(https://...) 형식으로 입력해 주세요.');
        if (inpCtaUrl && typeof inpCtaUrl.focus === 'function') inpCtaUrl.focus();
        return;
      }

      const isLoggedIn = Boolean(this.cloudUser && this.cloudUser.uid);
      const tier = isLoggedIn && typeof this.getUserSubscriptionTier === 'function'
        ? this.getUserSubscriptionTier()
        : 'free';

      if (!isLoggedIn || tier !== 'premium') {
        // 작성해 둔 문구 초안을 로컬에 보존한 뒤 즉시 Premium 업그레이드 창으로 자연스럽게 연결
        this._savePromoBannerConfigForCurrentUser(draft, Boolean(isLoggedIn));
        closeModal();
        const modalShare = document.getElementById('modalShare');
        if (modalShare) modalShare.classList.remove('show');
        this.openProPricingModal('premium');
        return;
      }

      if (draft.enabled && !draft.badgeText && !draft.messageText) {
        this.showToast('💡 배너를 켜려면 소속/선생님 이름 또는 한 줄 홍보 문구를 입력해 주세요.');
        if (inpMsg && typeof inpMsg.focus === 'function') inpMsg.focus();
        return;
      }

      this._savePromoBannerConfigForCurrentUser(draft, true);
      closeModal();
      this.showToast('✅ 뷰어 상단 홍보배너 설정이 저장되었습니다!');
    };
  }
}

syncSmartViewerPromoBannerUI(pkg = this._viewerPkg) {
  const headerEl = document.getElementById('smartNoteViewerHeader');
  const headerWrap = document.getElementById('viewerHeaderPromoBannerWrap');
  const gateWrap = document.getElementById('viewerGatePromoBannerWrap');
  const validBanner = this._getValidViewerPromoBanner(pkg);

  if (headerWrap) {
    headerWrap.innerHTML = '';
    if (validBanner) {
      headerWrap.appendChild(this._renderPromoBannerPillDOM(validBanner, 'header'));
      headerWrap.style.display = 'inline-flex';
    } else {
      headerWrap.style.display = 'none';
    }
  }
  if (headerEl) {
    headerEl.classList.toggle('has-promo-banner', Boolean(validBanner));
  }

  if (gateWrap) {
    gateWrap.innerHTML = '';
    if (validBanner) {
      gateWrap.appendChild(this._renderPromoBannerPillDOM(validBanner, 'gate'));
      gateWrap.style.display = 'flex';
    } else {
      gateWrap.style.display = 'none';
    }
  }
}

  async buildExportSharePackageObject(scope = 'current', filterOpts = null) {
  if (this.isAudioRecording) {
    await this.stopAudioRecording();
  } else if (this._pendingSlideAudioFinalizers && this._pendingSlideAudioFinalizers.length > 0) {
    await Promise.all(this._pendingSlideAudioFinalizers).catch(() => { });
    this._pendingSlideAudioFinalizers = [];
  }
  const effScope = scope || this.exportScope || 'current';
  const effFilter = filterOpts || this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
  const rawSlides = (effScope === 'all')
    ? this._getActiveSlidesForExport('공유된 수업 노트')
    : (this._isCapturingExportSnapshots && this._exportSnapshotLoopBackupCurrent
      ? [JSON.parse(JSON.stringify(this._exportSnapshotLoopBackupCurrent))]
      : [this.serializeFullSlideState('공유된 수업 노트')]);
  const filteredSlides = rawSlides.map(s => this._applyExportFilterToSlideData(s, effFilter));

  await this._populateSlideViewerSnapshotsForExport(filteredSlides, effFilter, true);

  const nowMs = Date.now();
  const quota = typeof this.getCurrentTierQuota === 'function'
    ? this.getCurrentTierQuota()
    : { tier: 'free', isGuest: !(this.cloudUser && this.cloudUser.uid), shareDailyLimit: 5, shareExpiryDays: 3, isPermanentShare: false };
  const isGuest = Boolean(quota.isGuest || !this.cloudUser || !this.cloudUser.uid);
  // Track A (칠판 [내보내기 / 공유] 즉석 링크): 전 요금제 공통으로 공용저장소 휘발성 단기 링크로 분리 (Guest·Free 3일 / Pro·Premium 7일 후 100% 자동 삭제)
  const isPaidShortTier = Boolean(!isGuest && (quota.tier === 'pro' || quota.tier === 'premium'));
  const expDays = isPaidShortTier
    ? (Number(quota.shareExpiryDays) > 0 ? Number(quota.shareExpiryDays) : 7)
    : (Number(quota.shareExpiryDays) > 0 ? Number(quota.shareExpiryDays) : 3);
  const expiresAtMs = nowMs + expDays * 24 * 60 * 60 * 1000;
  const randPart = this._generateSecureRandomAlphaNum(10);
  const shortId = 's' + nowMs.toString(36) + randPart;
  const effOwnerUid = (!isGuest && this.cloudUser && this.cloudUser.uid)
    ? this.cloudUser.uid
    : this._getOrCreateGuestShareDeviceId();
  const isPremiumUser = Boolean(!isGuest && quota.tier === 'premium');
  const effPromoBanner = isPremiumUser ? this.getEffectiveSharePromoBanner() : null;
  return {
    id: shortId,
    title: filteredSlides.length > 1
      ? `공유 수업 ${filteredSlides.length}문항 세트 (${new Date(nowMs).toLocaleDateString('ko-KR')})`
      : `공유 수업 노트 (${new Date(nowMs).toLocaleDateString('ko-KR')})`,
    createdAt: nowMs,
    updatedAt: nowMs,
    expiresAt: expiresAtMs,
    shareTier: isGuest ? 'guest' : (quota.tier || 'free'),
    shareExpiryDays: expDays,
    isPermanentShare: false,
    premiumActiveUntil: 0,
    promoBanner: effPromoBanner,
    ownerUid: effOwnerUid,
    exportScope: effScope,
    exportFilter: { ...effFilter },
    isPlaylist: filteredSlides.length > 1,
    playlistSlides: filteredSlides,
    currentIndex: 0
  };
}

// ============================================================================
// 🔑 [비로그인 기기 토큰 · 세션 편집 키 · KST 자정 기준 1일 3개 공유 쿼터 & 서버 티켓 연동]
// ============================================================================
_generateSecureRandomHex(byteLen = 16) {
  const len = Math.max(8, Number(byteLen) || 16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < arr.length; i++) {
      out += arr[i].toString(16).padStart(2, '0');
    }
    return out;
  }
  let fallback = '';
  while (fallback.length < len * 2) {
    fallback += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  }
  return fallback.slice(0, len * 2);
}

_generateSecureRandomAlphaNum(charLen = 10) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  const len = Math.max(6, Number(charLen) || 10);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += alphabet[arr[i] % 36];
    }
    return out;
  }
  let fallback = '';
  while (fallback.length < len) {
    fallback += Math.random().toString(36).slice(2);
  }
  return fallback.replace(/[^a-z0-9]/g, '0').slice(0, len);
}

_getKstDateKey(nowMs = Date.now()) {
  return new Date(Number(nowMs) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

_getOrCreateGuestShareDeviceId() {
  if (this._cachedGuestShareDeviceId && /^gdev_[a-f0-9]{24,64}$/.test(this._cachedGuestShareDeviceId)) {
    return this._cachedGuestShareDeviceId;
  }
  const storageKey = 'graphly_guest_device_id_v1';
  try {
    const saved = String(localStorage.getItem(storageKey) || '').trim();
    if (/^gdev_[a-f0-9]{24,64}$/.test(saved)) {
      this._cachedGuestShareDeviceId = saved;
      return saved;
    }
  } catch (e) { }
  const fresh = 'gdev_' + this._generateSecureRandomHex(16);
  this._cachedGuestShareDeviceId = fresh;
  try { localStorage.setItem(storageKey, fresh); } catch (e) { }
  if (typeof this._idbCacheSet === 'function') {
    this._idbCacheSet(storageKey, fresh, 0).catch(() => { });
  }
  return fresh;
}

_getOrCreateSessionOwnerEditKey(shortId) {
  const cleanId = String(shortId || '').trim();
  if (!this._sessionShareEditKeys) {
    this._sessionShareEditKeys = new Map();
  }
  if (this._sessionShareEditKeys.has(cleanId)) {
    return this._sessionShareEditKeys.get(cleanId);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const saved = String(sessionStorage.getItem('graphly_share_edit_key_' + cleanId) || '').trim();
      if (/^[a-f0-9]{24,64}$/.test(saved)) {
        this._sessionShareEditKeys.set(cleanId, saved);
        return saved;
      }
    }
  } catch (e) { }
  const freshKey = this._generateSecureRandomHex(16);
  this._sessionShareEditKeys.set(cleanId, freshKey);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('graphly_share_edit_key_' + cleanId, freshKey);
    }
  } catch (e) { }
  return freshKey;
}

_resetActiveShareSessionCache() {
  this._activeSessionShareShortId = '';
  this._lastShareNoteSessionKey = '';
  this._lastShareContentSig = '';
  this._lastShareTier = '';
  this._lastSessionShareManifestMeta = null;
}

_getShareDailyStorageKey() {
  if (this.cloudUser && this.cloudUser.uid) {
    const emailNorm = String(this.cloudUser.email || '').trim().toLowerCase();
    const acctTag = emailNorm ? emailNorm.replace(/[^a-z0-9@._-]/g, '_') : String(this.cloudUser.uid);
    return `graphly_share_daily_v1_user_${acctTag}`;
  }
  return `graphly_share_daily_v1_${this._getOrCreateGuestShareDeviceId()}`;
}

getShareDailyUsageStatus() {
  const quota = typeof this.getCurrentTierQuota === 'function'
    ? this.getCurrentTierQuota()
    : { tier: 'free', isGuest: !(this.cloudUser && this.cloudUser.uid), shareDailyLimit: 5 };
  const isGuest = Boolean(quota.isGuest || !this.cloudUser || !this.cloudUser.uid);
  const tier = isGuest ? 'guest' : (quota.tier || 'free');
  const dailyLimit = (tier === 'pro' || tier === 'premium') ? 0 : (Number(quota.shareDailyLimit) || 5);
  const kstDate = this._getKstDateKey();
  if (dailyLimit <= 0) {
    return {
      tier,
      isGuest: false,
      dailyLimit: 0,
      usedCount: 0,
      remainingCount: Infinity,
      kstDate
    };
  }
  let usedCount = 0;
  try {
    const raw = localStorage.getItem(this._getShareDailyStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === kstDate) {
        usedCount = Math.max(0, Number(parsed.count) || 0);
      }
    }
  } catch (e) { }
  return {
    tier,
    isGuest,
    dailyLimit,
    usedCount,
    remainingCount: Math.max(0, dailyLimit - usedCount),
    kstDate
  };
}

_syncLocalShareDailyUsage(kstDate, usedCount) {
  const effDate = String(kstDate || this._getKstDateKey());
  const effCount = Math.max(0, Number(usedCount) || 0);
  try {
    localStorage.setItem(this._getShareDailyStorageKey(), JSON.stringify({
      date: effDate,
      count: effCount,
      updatedAt: Date.now()
    }));
  } catch (e) { }
  if (typeof this.refreshShareTierNoticeUI === 'function') {
    this.refreshShareTierNoticeUI();
  }
}

_handleShareDailyLimitExceeded(isGuest = false) {
  const modalShare = document.getElementById('modalShare');
  if (modalShare) modalShare.classList.remove('show');
  const cfg = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
  const lim = (cfg && Number(cfg.freeShareDailyLimit) > 0) ? Number(cfg.freeShareDailyLimit) : 5;
  if (isGuest || !this.cloudUser || !this.cloudUser.uid) {
    if (typeof this.promptCloudLoginForLibrary === 'function') {
      this.promptCloudLoginForLibrary(`🔒 오늘 비로그인 공유 한도(1일 ${lim}개)를 모두 사용했습니다. 무료 로그인 시 계정당 1일 ${lim}개가 추가 제공됩니다!`);
    } else {
      this.showToast(`🔒 오늘 비로그인 공유 한도(1일 ${lim}개)를 모두 사용했습니다. 무료 로그인 후 이용해 주세요!`);
    }
    return;
  }
  this.showToast(`👑 오늘 무료 공유 링크 한도(1일 ${lim}개)를 모두 사용했습니다. Pro 업그레이드 시 무제한으로 공유됩니다!`);
  if (typeof this.openProPricingModal === 'function') {
    this.openProPricingModal('pro');
  }
}

_checkClientShareBurstGuard() {
  const cfg = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
  const maxPerMin = (cfg && Number(cfg.shareBurstLimitPerMin) > 0) ? Number(cfg.shareBurstLimitPerMin) : 15;
  const nowMs = Date.now();
  if (!Array.isArray(this._recentShareTicketTimestamps)) {
    this._recentShareTicketTimestamps = [];
  }
  this._recentShareTicketTimestamps = this._recentShareTicketTimestamps.filter(ts => (nowMs - ts) < 60000);
  if (this._recentShareTicketTimestamps.length >= maxPerMin) {
    this.showToast('⚠️ 단시간에 너무 많은 공유 링크 생성이 감지되었습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
  return true;
}

_recordClientShareBurstStamp() {
  if (!Array.isArray(this._recentShareTicketTimestamps)) {
    this._recentShareTicketTimestamps = [];
  }
  const nowMs = Date.now();
  this._recentShareTicketTimestamps = this._recentShareTicketTimestamps.filter(ts => (nowMs - ts) < 60000);
  this._recentShareTicketTimestamps.push(nowMs);
}

  async _requestShareUploadTicket(shortId, slideCount = 1, isReuse = false, shareSource = 'direct_board') {
  const isHttpEnv = Boolean(typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol));
  const isGuest = !this.cloudUser || !this.cloudUser.uid;
  const ownerEditKey = this._getOrCreateSessionOwnerEditKey(shortId);
  const deviceId = this._getOrCreateGuestShareDeviceId();

  if (!isHttpEnv) {
    const usage = this.getShareDailyUsageStatus();
    if (!isReuse && usage.dailyLimit > 0 && usage.remainingCount <= 0) {
      return { ok: false, code: 'DAILY_SHARE_LIMIT_EXCEEDED', dailyUsed: usage.usedCount, kstDate: usage.kstDate };
    }
    const nextUsed = (!isReuse && usage.dailyLimit > 0) ? (usage.usedCount + 1) : usage.usedCount;
    return {
      ok: true,
      fallbackLocal: true,
      dailyLimit: usage.dailyLimit,
      dailyUsed: nextUsed,
      kstDate: usage.kstDate
    };
  }

  const endpoint = this.SHARE_TICKET_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/issueShareUploadTicket';
  const headers = { 'Content-Type': 'application/json' };
  if (!isGuest && typeof this._getFirebaseIdTokenForRest === 'function') {
    const idToken = await this._getFirebaseIdTokenForRest(true);
    if (idToken) {
      headers['Authorization'] = 'Bearer ' + idToken;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        shortId,
        ownerEditKey,
        deviceId,
        uid: (!isGuest && this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : '',
        slideCount: Math.max(1, Number(slideCount) || 1),
        isReuse: Boolean(isReuse),
        shareSource: String(shareSource || 'direct_board')
      })
    });
    if (res.status === 404 && !isGuest) {
      // Cloud Functions 배포 전 환경에서 로그인 회원의 공유 중단 방지 폴백
      const usage = this.getShareDailyUsageStatus();
      if (!isReuse && usage.dailyLimit > 0 && usage.remainingCount <= 0) {
        return { ok: false, code: 'DAILY_SHARE_LIMIT_EXCEEDED', dailyUsed: usage.usedCount, kstDate: usage.kstDate };
      }
      return {
        ok: true,
        fallbackLocal: true,
        dailyLimit: usage.dailyLimit,
        dailyUsed: (!isReuse && usage.dailyLimit > 0) ? (usage.usedCount + 1) : usage.usedCount,
        kstDate: usage.kstDate
      };
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) {
      return data || { ok: false, code: `HTTP_${res.status}` };
    }
    return data;
  } catch (err) {
    if (!isGuest) {
      const usage = this.getShareDailyUsageStatus();
      if (!isReuse && usage.dailyLimit > 0 && usage.remainingCount <= 0) {
        return { ok: false, code: 'DAILY_SHARE_LIMIT_EXCEEDED', dailyUsed: usage.usedCount, kstDate: usage.kstDate };
      }
      return {
        ok: true,
        fallbackLocal: true,
        dailyLimit: usage.dailyLimit,
        dailyUsed: (!isReuse && usage.dailyLimit > 0) ? (usage.usedCount + 1) : usage.usedCount,
        kstDate: usage.kstDate
      };
    }
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

  async _lockShareUploadTicketOnServer(shortId) {
  const isHttpEnv = Boolean(typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol));
  if (!isHttpEnv || !shortId) return;
  const ownerEditKey = this._getOrCreateSessionOwnerEditKey(shortId);
  const endpoint = this.SHARE_LOCK_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/lockShareUploadTicket';
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortId, ownerEditKey })
    });
  } catch (e) { }
}

_computeShareNoteSessionKey(scope, slides) {
  const effScope = scope || 'current';
  const arr = Array.isArray(slides) ? slides : [];
  const first = arr[0] || {};
  const probSrc = (first.primaryProblemCard && first.primaryProblemCard.imgSrc) ? String(first.primaryProblemCard.imgSrc) : '';
  const pdfSrc = (first.pdfPageBoardData && first.pdfPageBoardData.dataUrl) ? String(first.pdfPageBoardData.dataUrl) : '';
  const probSig = probSrc ? `${probSrc.length}:${probSrc.slice(0, 48)}:${probSrc.slice(-48)}` : 'noprob';
  const pdfSig = pdfSrc ? `${pdfSrc.length}:${pdfSrc.slice(0, 48)}:${pdfSrc.slice(-48)}` : 'nopdf';
  return `${effScope}|cnt:${arr.length}|${probSig}|${pdfSig}`;
}

_computeShareContentSignature(scope, filterOpts, slides) {
  const f = filterOpts || {};
  const promoSig = typeof this._getPromoBannerSignature === 'function' ? this._getPromoBannerSignature() : 'nopromo';
  const filterKey = `${scope || 'current'}|${Boolean(f.includeProblem)}|${Boolean(f.includeGraph)}|${Boolean(f.includeInk)}|${f.includeAudio !== false}|${promoSig}`;
  const arr = Array.isArray(slides) ? slides : [];
  const slideSigs = arr.map((s, idx) => {
    if (!s) return String(idx);
    const hStr = typeof s.historyJson === 'string' ? s.historyJson : JSON.stringify(s.historyJson || {});
    const pLen = (s.primaryProblemCard && s.primaryProblemCard.imgSrc) ? s.primaryProblemCard.imgSrc.length : 0;
    const pInkLen = (s.primaryProblemCard && Array.isArray(s.primaryProblemCard.problemInkStrokes)) ? JSON.stringify(s.primaryProblemCard.problemInkStrokes).length : 0;
    const gLen = (s.primaryGraphCard && s.primaryGraphCard.graphSnapshot) ? JSON.stringify(s.primaryGraphCard.graphSnapshot).length : 0;
    const gInkLen = (s.primaryGraphCard && Array.isArray(s.primaryGraphCard.graphInkStrokes)) ? JSON.stringify(s.primaryGraphCard.graphInkStrokes).length : 0;
    const exPLen = Array.isArray(s.extraProblems) ? s.extraProblems.length : 0;
    const exGLen = Array.isArray(s.extraGraphs) ? s.extraGraphs.length : 0;
    const audDur = (s.audioSyncData && s.audioSyncData.durationMs) ? s.audioSyncData.durationMs : 0;
    const audCreated = (s.audioSyncData && s.audioSyncData.createdAt) ? s.audioSyncData.createdAt : 0;
    return `${idx}:${hStr.length}:${hStr.slice(0, 64)}:${hStr.slice(-64)}:${pLen}:${pInkLen}:${gLen}:${gInkLen}:${exPLen}:${exGLen}:${audDur}:${audCreated}`;
  });
  return `${filterKey}||${slideSigs.join('||')}`;
}

  async _purgeExpiredSharedWorkspaces() {
  const nowMs = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('graphly_cloud_share_') || k.startsWith('graphly_full_doc_s'))) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj.isPermanentShare === true || obj.expiresAt === 0) continue;
            const expDays = Number(obj.shareExpiryDays) || 7;
            const exp = Number(obj.expiresAt) || ((obj.createdAt || 0) + (expDays * 86400000 || SEVEN_DAYS_MS));
            if (obj.createdAt && nowMs > exp) {
              localStorage.removeItem(k);
            }
          }
        } catch (_) {
          localStorage.removeItem(k);
        }
      }
    }
  } catch (e) { }
  // IndexedDB 내 만료된 공유 캐시 및 오래된 캐시 자동 정리 (expiresAt === 0 영구 공유는 보존)
  if (typeof this._idbCachePurgeExpired === 'function') {
    await this._idbCachePurgeExpired(nowMs, 80).catch(() => { });
  }
}

  async createCloudSharePackage(scope = null, filterOpts = null) {
  // 0) 활성 재사용 세션이 없는 신규 공유 시, 로컬 1일 3개 한도 도달 여부를 스냅샷 렌더링 전에 0.00초 즉시 점검!
  const preUsage = this.getShareDailyUsageStatus();
  if (!this._activeSessionShareShortId && preUsage.dailyLimit > 0 && preUsage.remainingCount <= 0) {
    this._handleShareDailyLimitExceeded(preUsage.isGuest);
    return null;
  }

  this._purgeExpiredSharedWorkspaces().catch(() => { });
  const effScope = scope || this.exportScope || 'current';
  const effFilter = filterOpts || this.exportFilter;
  const pkg = await this.buildExportSharePackageObject(effScope, effFilter);

  const maxSlides = typeof this.getMaxLessonSlidesLimit === 'function' ? this.getMaxLessonSlidesLimit() : 50;
  if (Array.isArray(pkg.playlistSlides) && pkg.playlistSlides.length > maxSlides) {
    this.showToast(`⚠️ 공유 링크는 한 번에 최대 ${maxSlides}문항까지만 생성할 수 있습니다. (현재 ${pkg.playlistSlides.length}문항)`);
    return null;
  }

  const noteSessionKey = this._computeShareNoteSessionKey(effScope, pkg.playlistSlides);
  const contentSig = this._computeShareContentSignature(effScope, effFilter, pkg.playlistSlides);

  // 1) 내용이 1비트도 안 바뀐 상태에서 공유 모달을 다시 열어 버튼을 누른 경우: 서버 재업로드 없이 기존 링크 0.00초 즉시 반환!
  if (
    this._activeSessionShareShortId &&
    this._lastShareNoteSessionKey === noteSessionKey &&
    this._lastShareContentSig === contentSig &&
    this._lastShareTier === pkg.shareTier
  ) {
    return this._activeSessionShareShortId;
  }

  // 2) 동일한 문제/수업 노트 & 동일 등급에서 필기·오타·음성을 수정하고 다시 공유를 누른 경우: 직전 shortId 재사용 (쿼터 추가 차감 0!)
  const isReusingSessionShortId = Boolean(
    this._activeSessionShareShortId &&
    this._lastShareNoteSessionKey === noteSessionKey &&
    this._lastShareTier === pkg.shareTier
  );
  if (!isReusingSessionShortId && preUsage.dailyLimit > 0 && preUsage.remainingCount <= 0) {
    this._handleShareDailyLimitExceeded(preUsage.isGuest);
    return null;
  }
  if (!isReusingSessionShortId && typeof this._checkClientShareBurstGuard === 'function' && !this._checkClientShareBurstGuard()) {
    return null;
  }
  if (isReusingSessionShortId) {
    pkg.id = this._activeSessionShareShortId;
  }
  const shortId = pkg.id;
  const prevSessionMeta = isReusingSessionShortId ? this._lastSessionShareManifestMeta : null;

  const fullPkgJson = this._stringifyWithDeduplicatedSnapshots(pkg);
  const compressedFullPkg = await this._compressJsonStringGzipBase64(fullPkgJson);
  const cfgSingle = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
  const maxSingleBytes = (cfgSingle && Number(cfgSingle.maxSingleSharePayloadBytes) > 0)
    ? Number(cfgSingle.maxSingleSharePayloadBytes)
    : (80 * 1024 * 1024);
  if (this._measureUtf8Bytes(compressedFullPkg) > maxSingleBytes) {
    const limStr = typeof this.formatBytesHuman === 'function' ? this.formatBytesHuman(maxSingleBytes) : '80 MB';
    this.showToast(`⚠️ 공유 불가: 단일 공유 패키지 최대 용량(${limStr})을 초과했습니다. 슬라이드를 나누어 공유해 주세요.`);
    return null;
  }

  // 3) 서버 티켓 발급 & 일일 쿼터 · 버스트 원자적 검증 ('direct_board' 단기 휘발성 공유 트랙)
  const ticketRes = await this._requestShareUploadTicket(
    shortId,
    Array.isArray(pkg.playlistSlides) ? pkg.playlistSlides.length : 1,
    isReusingSessionShortId,
    'direct_board'
  );
  if (!ticketRes || !ticketRes.ok) {
    if (ticketRes && ticketRes.code === 'DAILY_SHARE_LIMIT_EXCEEDED') {
      this._syncLocalShareDailyUsage(ticketRes.kstDate, ticketRes.dailyUsed || preUsage.dailyLimit || 5);
      this._handleShareDailyLimitExceeded(preUsage.isGuest);
    } else if (ticketRes && ticketRes.code === 'SHARE_BURST_RATE_LIMIT') {
      this.showToast('⚠️ 단시간에 너무 많은 공유 링크 생성이 감지되었습니다. 잠시 후 다시 시도해 주세요.');
    } else if (ticketRes && ticketRes.code === 'FAIR_USE_SHARE_LIMIT_EXCEEDED') {
      this.showToast('⚠️ 비정상 자동화 방지를 위한 일일 공정 사용 상한에 도달했습니다. 자정 이후 초기화됩니다.');
    } else if (ticketRes && ticketRes.code === 'IP_EMERGENCY_RATE_LIMIT') {
      this.promptCloudLoginForLibrary('⚠️ 현재 네트워크의 비로그인 일일 비상 한도에 도달했습니다. 무료 로그인 후 즉시 공유할 수 있습니다!');
    } else {
      this.showToast('⚠️ 공유 링크 티켓 발급에 실패했습니다. 네트워크 연결을 확인해 주세요.');
    }
    return null;
  }
  if (!isReusingSessionShortId && typeof this._recordClientShareBurstStamp === 'function') {
    this._recordClientShareBurstStamp();
  }

  // 칠판 미저장 즉석 공유(Track A)는 항상 공용저장소 단기 휘발성 링크(3일/7일)로 동작하며 클라우드 보관함에 임시 파일을 자동 생성하지 않음!
  pkg.isPermanentShare = false;
  pkg.premiumActiveUntil = 0;
  if (!ticketRes.fallbackLocal && Number(ticketRes.shareExpiryDays) > 0 && Number(ticketRes.expiresAtMs) > 0) {
    pkg.shareExpiryDays = Number(ticketRes.shareExpiryDays);
    pkg.expiresAt = Number(ticketRes.expiresAtMs);
  }

  const updatedPkgJson = this._stringifyWithDeduplicatedSnapshots(pkg);

  // 4) 음성 데이터 Lazy Load 분리 준비
  const cloudPkg = JSON.parse(updatedPkgJson);
  const audioMap = {};
  let hasAnyAudio = false;
  if (Array.isArray(cloudPkg.playlistSlides)) {
    cloudPkg.playlistSlides.forEach((sl, idx) => {
      if (sl && sl.audioSyncData && sl.audioSyncData.durationMs > 0) {
        hasAnyAudio = true;
        audioMap[idx] = sl.audioSyncData;
        sl.audioSyncData = {
          durationMs: sl.audioSyncData.durationMs,
          stageW: sl.audioSyncData.stageW || 1440,
          stageH: sl.audioSyncData.stageH || 900,
          createdAt: sl.audioSyncData.createdAt || Date.now(),
          _isLazyAudioStub: true,
          _lazySlideIdx: idx
        };
      }
    });
  }

  const audioNetStr = hasAnyAudio
    ? await this._compressJsonStringGzipBase64(JSON.stringify(audioMap))
    : '';

  const baseUid = (this.cloudUser && this.cloudUser.uid)
    ? this.cloudUser.uid
    : this._getOrCreateGuestShareDeviceId();

  // 5) 서버 업로드 실행 (실패 시 가짜 성공 없이 즉시 null 반환하여 데이터 무결성 100% 보장)
  try {
    const CHUNK_LIMIT = 700000;
    let uploadedAudioChunkCount = 0;
    const audioPrefix = `${shortId}_audio_`;
    if (hasAnyAudio && audioNetStr) {
      const audioChunks = this._splitStringIntoSafeFirestoreChunks(audioNetStr, CHUNK_LIMIT);
      const AUDIO_BATCH_SIZE = 6;
      for (let b = 0; b < audioChunks.length; b += AUDIO_BATCH_SIZE) {
        const batchSlice = audioChunks.slice(b, b + AUDIO_BATCH_SIZE);
        await Promise.all(batchSlice.map((cStr, localIdx) => {
          const idx = b + localIdx;
          return this._firestoreRestWriteSingleDoc(
            'shared_workspaces',
            `${audioPrefix}${idx}`,
            JSON.stringify({ _isChunkPart: true, _isAudioChunk: true, parentId: shortId, partIndex: idx, data: cStr }),
            { ownerUid: `chunk_audio_${baseUid}`, expireAtMs: pkg.expiresAt || 0 }
          );
        }));
      }
      uploadedAudioChunkCount = audioChunks.length;
      cloudPkg._hasLazyAudio = true;
      cloudPkg._audioChunkCollection = 'shared_workspaces';
      cloudPkg._audioChunkPrefix = audioPrefix;
      cloudPkg._audioChunkCount = uploadedAudioChunkCount;
    }

    await this._firestoreRestWrite('shared_workspaces', shortId, cloudPkg, {
      skipLocalFullCache: true,
      baseOwnerUid: baseUid,
      expireAtMs: pkg.expiresAt || 0,
      isPermanentShare: false,
      premiumActiveUntilMs: 0
    });

    // 이전 세션 공유를 덮어쓴 경우 티켓 잠금 직전에 남은 꼬리 청크 정리
    if (prevSessionMeta) {
      const cleanTasks = [];
      const oldPartCnt = Number(prevSessionMeta._chunkCount) || 0;
      const newPartCnt = Number(cloudPkg._chunkCount) || 0;
      const oldPartPrefix = prevSessionMeta._chunkDocPrefix || `${shortId}_part_`;
      for (let ci = newPartCnt; ci < oldPartCnt; ci++) {
        cleanTasks.push(this._firestoreRestDeleteDoc('shared_workspaces', `${oldPartPrefix}${ci}`).catch(() => { }));
      }
      const oldAudCnt = Number(prevSessionMeta._audioChunkCount) || 0;
      const oldAudPrefix = prevSessionMeta._audioChunkPrefix || `${shortId}_audio_`;
      for (let ai = uploadedAudioChunkCount; ai < oldAudCnt; ai++) {
        cleanTasks.push(this._firestoreRestDeleteDoc('shared_workspaces', `${oldAudPrefix}${ai}`).catch(() => { }));
      }
      if (cleanTasks.length) {
        await Promise.all(cleanTasks);
      }
    }

    // 업로드 완료 즉시 서버 티켓 잠금 (외부 열람자의 사후 위변조 0% 보장)
    if (!ticketRes.fallbackLocal) {
      await this._lockShareUploadTicketOnServer(shortId);
    }

    this._lastSessionShareManifestMeta = {
      id: shortId,
      _isChunked: Boolean(cloudPkg._isChunked),
      _chunkCollection: cloudPkg._chunkCollection || 'shared_workspaces',
      _chunkDocPrefix: cloudPkg._chunkDocPrefix || `${shortId}_part_`,
      _chunkCount: cloudPkg._chunkCount || 0,
      _hasLazyAudio: Boolean(cloudPkg._hasLazyAudio),
      _audioChunkCollection: 'shared_workspaces',
      _audioChunkPrefix: cloudPkg._audioChunkPrefix || `${shortId}_audio_`,
      _audioChunkCount: cloudPkg._audioChunkCount || 0
    };
  } catch (err) {
    await this._lockShareUploadTicketOnServer(shortId);
    this.showToast('⚠️ 공유 링크 서버 업로드에 실패했습니다. 네트워크 연결 상태를 확인해 주세요.');
    return null;
  }

  if (ticketRes && Number(ticketRes.dailyLimit) > 0) {
    this._syncLocalShareDailyUsage(ticketRes.kstDate, ticketRes.dailyUsed);
  }

  this._activeSessionShareShortId = shortId;
  this._lastShareNoteSessionKey = noteSessionKey;
  this._lastShareContentSig = contentSig;
  this._lastShareTier = pkg.shareTier;

  // 로컬 IndexedDB 캐시 저장
  await this._idbCacheSet('graphly_cloud_share_' + shortId, compressedFullPkg, pkg.expiresAt || 0).catch(() => { });
  await this._idbCacheSet('graphly_full_doc_' + shortId, compressedFullPkg, pkg.expiresAt || 0).catch(() => { });
  try { localStorage.removeItem('graphly_cloud_share_' + shortId); } catch (e) { }

  return shortId;
}

  // 🌟 [공유 링크의 음성 강의 데이터를 학생이 실제로 '▶️ 영상 보기' 또는 '✏️ 편집하기'를 눌렀을 때만 온디맨드 로드!]
  async _ensureCloudShareAudioLoaded(pkg) {
  if (!pkg || !Array.isArray(pkg.playlistSlides)) return pkg;
  const vaultAudioKey = String(
    pkg._vaultAudioKey ||
    (pkg.vaultRefs && pkg.vaultRefs.audioKey) ||
    ''
  );
  const needsLazyLoad = Boolean(
    (pkg._hasLazyAudio && ((pkg._audioChunkCount > 0 && pkg._audioChunkPrefix) || vaultAudioKey)) ||
    pkg.playlistSlides.some(s => s && s.audioSyncData && s.audioSyncData._isLazyAudioStub)
  );
  if (!needsLazyLoad) return pkg;

  const audioPrefix = pkg._audioChunkPrefix || (pkg.id ? `${pkg.id}_audio_` : '');
  const audioCount = Number(pkg._audioChunkCount) || 0;
  const audioCol = pkg._audioChunkCollection || 'shared_workspaces';
  if (!vaultAudioKey && (!audioPrefix || audioCount <= 0)) return pkg;

  if (this._activeLazyAudioLoadPromise && this._activeLazyAudioLoadPkgId === pkg.id) {
    await this._activeLazyAudioLoadPromise;
    return pkg;
  }

  const loadTask = (async () => {
    try {
      // 1. 먼저 IndexedDB에 최신 버전의 전체 오디오가 포함된 캐시가 있는지 확인
      if (pkg.id && !pkg._forceSkipVaultCache) {
        const cachedRaw = await this._idbCacheGet('graphly_cloud_share_' + pkg.id) || await this._idbCacheGet('graphly_full_doc_' + pkg.id);
        if (cachedRaw) {
          const uncomp = typeof cachedRaw === 'string'
            ? await this._decompressJsonStringGzipBase64(cachedRaw)
            : JSON.stringify(cachedRaw);
          const parsedCached = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
          const cacheStampOk = !pkg._fromVaultPointer ||
            !pkg._vaultUpdatedAt ||
            (Number(parsedCached && parsedCached._vaultUpdatedAt) || 0) >= Number(pkg._vaultUpdatedAt || 0);
          if (
            cacheStampOk &&
            parsedCached &&
            Array.isArray(parsedCached.playlistSlides) &&
            parsedCached.playlistSlides.some(s => s && s.audioSyncData && !s.audioSyncData._isLazyAudioStub && (s.audioSyncData.audioDataUrl || (Array.isArray(s.audioSyncData.audioSegments) && s.audioSyncData.audioSegments.length > 0)))
          ) {
            parsedCached.playlistSlides.forEach((cachedSlide, idx) => {
              if (cachedSlide && cachedSlide.audioSyncData && !cachedSlide.audioSyncData._isLazyAudioStub && pkg.playlistSlides[idx]) {
                pkg.playlistSlides[idx].audioSyncData = cachedSlide.audioSyncData;
              }
            });
            pkg._hasLazyAudio = false;
            pkg._lazyAudioLoaded = true;
            return pkg;
          }
        }
      }

      let audioMap = null;
      if (vaultAudioKey && typeof this._readCloudVaultLayerData === 'function') {
        // 2-A. 6-채널 볼트(cloud_share_vault) 오디오 레이어 온디맨드 로드
        const vaultAudioObj = await this._readCloudVaultLayerData(vaultAudioKey, Boolean(pkg._forceSkipVaultCache));
        if (vaultAudioObj && vaultAudioObj.audioMap && typeof vaultAudioObj.audioMap === 'object') {
          audioMap = vaultAudioObj.audioMap;
        }
      } else {
        // 2-B. 기존 shared_workspaces / user_library 음성 청크 병렬 다운로드 및 복원
        const audioAuthHeaders = (audioCol === 'user_library')
          ? await this._buildFirestoreRestHeaders(false, true)
          : {};
        const indices = Array.from({ length: audioCount }, (_, i) => i);
        const parts = await Promise.all(indices.map(async (idx) => {
          const chunkDocId = `${audioPrefix}${idx}`;
          const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${audioCol}/${encodeURIComponent(chunkDocId)}`;
          const r = await this._fetchFirestoreDocWithRetry(url, Object.keys(audioAuthHeaders).length ? { headers: audioAuthHeaders } : undefined);
          if (!r || !r.ok) return null;
          const d = await r.json();
          if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
            const pObj = JSON.parse(d.fields.jsonPayload.stringValue);
            if (typeof pObj.data === 'string' && pObj.data.length > 0) {
              return pObj.data;
            }
          }
          return null;
        }));
        const allAudioChunksOk = audioCount > 0 && parts.length === audioCount && parts.every(p => typeof p === 'string' && p.length > 0);
        if (!allAudioChunksOk) return pkg;
        const joined = parts.join('');
        const decompressed = await this._decompressJsonStringGzipBase64(joined);
        audioMap = JSON.parse(decompressed);
      }

      if (audioMap && typeof audioMap === 'object') {
        const effFilter = pkg.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
        const incProb = effFilter.includeProblem !== false;
        const incGraph = effFilter.includeGraph !== false;
        const incInk = effFilter.includeInk !== false;
        const needsAudioFilter = Boolean((!incProb || !incGraph || !incInk) && typeof this._applyExportFilterToAudioSyncData === 'function');

        const applyAudioMapToSlides = (slidesArr) => {
          if (!Array.isArray(slidesArr)) return;
          Object.keys(audioMap).forEach((k) => {
            const sIdx = Number(k);
            if (slidesArr[sIdx] && audioMap[k]) {
              const rawClone = JSON.parse(JSON.stringify(audioMap[k]));
              slidesArr[sIdx].audioSyncData = needsAudioFilter
                ? this._applyExportFilterToAudioSyncData(rawClone, { includeProblem: incProb, includeGraph: incGraph, includeInk: incInk })
                : rawClone;
            }
          });
        };
        applyAudioMapToSlides(pkg.playlistSlides);
        if (this._viewerPkg && this._viewerPkg.id === pkg.id && this._viewerPkg !== pkg) {
          applyAudioMapToSlides(this._viewerPkg.playlistSlides);
          this._viewerPkg._hasLazyAudio = false;
          this._viewerPkg._lazyAudioLoaded = true;
        }
        if (this._initialSharedCloudPkg && this._initialSharedCloudPkg.id === pkg.id && this._initialSharedCloudPkg !== pkg) {
          applyAudioMapToSlides(this._initialSharedCloudPkg.playlistSlides);
          this._initialSharedCloudPkg._hasLazyAudio = false;
          this._initialSharedCloudPkg._lazyAudioLoaded = true;
        }
        if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides)) {
          applyAudioMapToSlides(this.lessonPlaylistSlides);
        }
        pkg._hasLazyAudio = false;
        pkg._lazyAudioLoaded = true;
        delete pkg._forceSkipVaultCache;

        // 3. 음성까지 완전체로 합쳐진 패키지를 IndexedDB에 캐싱 (새로고침이나 재방문 시 재다운로드 0바이트!)
        if (pkg.id) {
          const hydratedCompressed = await this._compressJsonStringGzipBase64(this._stringifyWithDeduplicatedSnapshots(pkg));
          await this._idbCacheSet('graphly_cloud_share_' + pkg.id, hydratedCompressed, pkg.expiresAt || 0).catch(() => { });
          await this._idbCacheSet('graphly_full_doc_' + pkg.id, hydratedCompressed, pkg.expiresAt || 0).catch(() => { });
        }
      }
    } catch (e) { }
    return pkg;
  })();

  this._activeLazyAudioLoadPkgId = pkg.id || '';
  this._activeLazyAudioLoadPromise = loadTask;
  try {
    return await loadTask;
  } finally {
    if (this._activeLazyAudioLoadPromise === loadTask) {
      this._activeLazyAudioLoadPromise = null;
      this._activeLazyAudioLoadPkgId = '';
    }
  }
}

showPermanentShareLockedModal(graceDays = 7) {
  const existing = document.getElementById('modalPermanentShareLocked');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  const overlay = document.createElement('div');
  overlay.id = 'modalPermanentShareLocked';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:13500;background:rgba(15,23,42,0.66);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:18px;';
  overlay.innerHTML = `
      <div style="width:100%;max-width:410px;background:#ffffff;border-radius:20px;padding:26px 24px 22px;box-shadow:0 24px 60px rgba(15,23,42,0.34);text-align:center;color:#0f172a;font-family:Pretendard,sans-serif;">
        <div style="font-size:40px;line-height:1;margin-bottom:12px;">🔒</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px;letter-spacing:-0.3px;">일시 잠금된 공유 링크입니다</div>
        <div style="font-size:13px;color:#475569;line-height:1.65;margin-bottom:18px;">
          작성자의 <strong>Premium 구독</strong>이 만료된 후 유예기간(${graceDays}일)이 지나<br>
          현재 외부 열람이 일시 중지된 상태입니다.<br>
          <span style="display:inline-block;margin-top:6px;font-size:12px;color:#64748b;">
            (수업 데이터는 삭제되지 않았으며, 작성자가 구독을 갱신하면<br>기존 링크와 QR 코드 그대로 즉시 복구됩니다.)
          </span>
        </div>
        <button type="button" id="btnClosePermShareLockModal"
          style="width:100%;height:42px;border:none;border-radius:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:13.5px;font-weight:800;cursor:pointer;">
          확인
        </button>
      </div>
    `;
  document.body.appendChild(overlay);
  const btnClose = overlay.querySelector('#btnClosePermShareLockModal');
  if (btnClose) {
    btnClose.onclick = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }
  overlay.onclick = (e) => {
    if (e.target === overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
}

showShareDailyViewLimitModal(dailyViewLimit = 30, linkTier = 'free') {
  const existing = document.getElementById('modalShareDailyViewLimit');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  const effLim = Math.max(1, Number(dailyViewLimit) || (linkTier === 'premium' ? 300 : (linkTier === 'pro' ? 100 : 30)));
  const overlay = document.createElement('div');
  overlay.id = 'modalShareDailyViewLimit';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:13550;background:rgba(15,23,42,0.64);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:18px;';
  overlay.innerHTML = `
      <div style="width:100%;max-width:416px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:26px 24px 22px;box-shadow:0 24px 60px rgba(15,23,42,0.30);text-align:center;color:#0f172a;font-family:Pretendard,sans-serif;word-break:keep-all;">
        <div style="width:46px;height:46px;margin:0 auto 14px;border-radius:13px;background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;display:flex;align-items:center;justify-content:center;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <div style="font-size:17.5px;font-weight:800;margin-bottom:8px;letter-spacing:-0.3px;">일일 열람 트래픽 한도에 도달한 링크입니다</div>
        <div style="font-size:13px;color:#475569;line-height:1.65;margin-bottom:18px;">
          무단 대규모 유포 및 서버 과부하 방지를 위해<br>
          이 공유 링크의 오늘 열람 가능 인원(<strong>일 최대 ${effLim}명</strong>)이 모두 소진되었습니다.<br>
          <span style="display:inline-block;margin-top:7px;font-size:12px;color:#64748b;">
            매일 자정(00:00)에 열람 한도가 자동으로 초기화됩니다.<br>
            (Pro 일 100명 · Premium 일 300명 대규모 반 열람 지원)
          </span>
        </div>
        <button type="button" id="btnCloseShareViewLimitModal"
          style="width:100%;height:41px;border:none;border-radius:10px;background:#0f172a;color:#ffffff;font-size:13.5px;font-weight:700;cursor:pointer;">
          확인
        </button>
      </div>
    `;
  document.body.appendChild(overlay);
  const btnClose = overlay.querySelector('#btnCloseShareViewLimitModal');
  if (btnClose) {
    btnClose.onclick = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
  }
  overlay.onclick = (e) => {
    if (e.target === overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
}

  async _verifyShareViewTrafficQuota(shortId) {
  if (!shortId) return false;
  const isHttpEnv = Boolean(typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol));
  if (!isHttpEnv) return true;

  const kstDate = this._getKstDateKey();
  const passStorageKey = `graphly_share_view_pass_v1_${shortId}`;
  if (!this._forceVerifyShareViewOnServer) {
    try {
      const rawPass = localStorage.getItem(passStorageKey);
      if (rawPass) {
        const parsedPass = JSON.parse(rawPass);
        if (parsedPass && parsedPass.date === kstDate) {
          return true;
        }
      }
    } catch (_) { }
  }

  const endpoint = this.SHARE_VIEW_CHECK_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/checkShareViewAccess';
  const headers = { 'Content-Type': 'application/json' };
  if (this.cloudUser && this.cloudUser.uid && typeof this._getFirebaseIdTokenForRest === 'function') {
    try {
      const idToken = await this._getFirebaseIdTokenForRest(false);
      if (idToken) {
        headers['Authorization'] = 'Bearer ' + idToken;
      }
    } catch (_) { }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        shortId,
        deviceId: this._getOrCreateGuestShareDeviceId()
      })
    });
    if (res.status === 404) {
      // Cloud Functions 배포 전 구간에서는 안전 통과(Fail-Open)
      return true;
    }
    const data = await res.json().catch(() => null);
    if (res.status === 429 || (data && data.code === 'DAILY_VIEW_LIMIT_EXCEEDED')) {
      this.showShareDailyViewLimitModal(
        data && data.dailyViewLimit,
        data && data.linkTier
      );
      return false;
    }
    if (res.ok && data && data.ok) {
      if (!data.notFound) {
        try {
          localStorage.setItem(passStorageKey, JSON.stringify({
            date: String(data.kstDate || kstDate),
            ts: Date.now()
          }));
        } catch (_) { }
      }
      return true;
    }
    return true;
  } catch (_) {
    return true;
  }
}

  async restoreFromCloudShareId(shortId, isStudent = false) {
  if (!shortId) return;
  this._activeLoadedCloudLibraryMeta = null;

  // 0) 대규모 카페/커뮤니티 무단 유포 방어: 대용량 본문(PDF·이미지·음성) 다운로드 전에 일일 열람 가능 인원(30/100/300명) 우선 확인!
  const viewAllowed = await this._verifyShareViewTrafficQuota(shortId);
  if (!viewAllowed) {
    return;
  }
  let pkg = null;
  let forceFreshVaultFetch = false;
  try {
    const idbRaw = await this._idbCacheGet('graphly_cloud_share_' + shortId) || await this._idbCacheGet('graphly_full_doc_' + shortId);
    const localRaw = idbRaw || localStorage.getItem('graphly_cloud_share_' + shortId);
    if (localRaw) {
      const uncomp = typeof localRaw === 'string'
        ? await this._decompressJsonStringGzipBase64(localRaw)
        : JSON.stringify(localRaw);
      pkg = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
      if (pkg) this._restoreDeduplicatedSlideSnapshots(pkg);
    }
  } catch (e) { }

  const purgeLocalShareCaches = async (targetPkg) => {
    try { localStorage.removeItem('graphly_cloud_share_' + shortId); } catch (_) { }
    await this._idbCacheDelete('graphly_cloud_share_' + shortId).catch(() => { });
    await this._idbCacheDelete('graphly_full_doc_' + shortId).catch(() => { });
    if (targetPkg && targetPkg.vaultRefs && typeof targetPkg.vaultRefs === 'object') {
      await Promise.all(
        Object.values(targetPkg.vaultRefs)
          .filter(Boolean)
          .map(vk => this._idbCacheDelete('graphly_vault_layer_' + vk).catch(() => { }))
      );
    }
  };

  // 캐시에 영구 공유 링크 또는 클라우드 볼트 주소표(_fromVaultPointer)가 있을 경우:
  // ① 원본 삭제 여부, ② 작성자의 덮어쓰기(오타 수정) 최신 버전 여부, ③ 최신 구독 연장일(premiumActiveUntil)을 실시간 확인!
  if (
    pkg &&
    (pkg._fromVaultPointer || pkg.isPermanentShare || pkg._topIsPermanentShare || pkg.expiresAt === 0) &&
    typeof navigator !== 'undefined' && navigator.onLine !== false &&
    typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)
  ) {
    try {
      const checkUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/shared_workspaces/${encodeURIComponent(shortId)}`;
      const skKey = pkg._vaultSkeletonKey || (pkg.vaultRefs && pkg.vaultRefs.skeletonKey) || '';
      const skUrl = skKey
        ? `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/cloud_share_vault/${encodeURIComponent(skKey)}`
        : '';
      const [checkRes, skRes] = await Promise.all([
        fetch(checkUrl),
        skUrl ? fetch(skUrl) : Promise.resolve(null)
      ]);

      if (checkRes.status === 404 || (skRes && skRes.status === 404)) {
        await purgeLocalShareCaches(pkg);
        this.showToast('🗑️ 작성자가 보관함에서 삭제하여 만료된 공유 링크입니다.');
        return;
      }

      let vaultChanged = false;
      if (skRes && skRes.ok) {
        const skDoc = await skRes.json();
        if (skDoc && skDoc.fields && skDoc.fields.jsonPayload && skDoc.fields.jsonPayload.stringValue) {
          const rawSkStr = await this._decompressJsonStringGzipBase64(skDoc.fields.jsonPayload.stringValue);
          const parsedSk = JSON.parse(rawSkStr);
          const serverVaultStamp = Number(parsedSk && parsedSk.vaultUpdatedAt) || 0;
          const cachedVaultStamp = Number(pkg._vaultUpdatedAt) || 0;
          if (serverVaultStamp > 0 && serverVaultStamp !== cachedVaultStamp) {
            vaultChanged = true;
          }
        }
      }

      if (vaultChanged) {
        await purgeLocalShareCaches(pkg);
        pkg = null;
        forceFreshVaultFetch = true;
      } else if (checkRes.ok) {
        const checkData = await checkRes.json();
        const serverUpdateMs = (checkData && checkData.updateTime) ? (Date.parse(checkData.updateTime) || 0) : 0;
        const cachedStampMs = Number(pkg.updatedAt || pkg.createdAt || 0);
        if (!pkg._fromVaultPointer && serverUpdateMs > 0 && cachedStampMs > 0 && serverUpdateMs > cachedStampMs + 5000) {
          pkg = null;
          forceFreshVaultFetch = true;
        } else if (checkData && checkData.fields) {
          if (checkData.fields.isPermanentShare && checkData.fields.isPermanentShare.booleanValue) {
            pkg._topIsPermanentShare = true;
          }
          if (checkData.fields.premiumActiveUntil && checkData.fields.premiumActiveUntil.integerValue !== undefined) {
            pkg._hasTopPremiumActiveUntil = true;
            pkg._topPremiumActiveUntil = Number(checkData.fields.premiumActiveUntil.integerValue) || 0;
          }
        }
      }
    } catch (_) { }
  }

  if (!pkg) {
    try {
      pkg = await this._firestoreRestReadDoc('shared_workspaces', shortId, forceFreshVaultFetch);
      if (pkg && pkg._vaultOriginDeleted) {
        await purgeLocalShareCaches(pkg);
        this.showToast('🗑️ 작성자가 보관함에서 삭제하여 만료된 공유 링크입니다.');
        return;
      }
      if (pkg && forceFreshVaultFetch) {
        pkg._forceSkipVaultCache = true;
      }
      if (pkg && Array.isArray(pkg.playlistSlides) && pkg.playlistSlides.length > 0) {
        this._restoreDeduplicatedSlideSnapshots(pkg);
        const compPkg = await this._compressJsonStringGzipBase64(this._stringifyWithDeduplicatedSnapshots(pkg));
        await this._idbCacheSet('graphly_cloud_share_' + shortId, compPkg, pkg.expiresAt || 0).catch(() => { });
      }
    } catch (e) { }
  }

  if (!pkg) {
    this.showToast('⚠️ 존재하지 않거나 이미 만료·삭제된 공유 링크입니다.');
    return;
  }

  const isPermShare = Boolean(pkg.isPermanentShare || pkg._topIsPermanentShare || pkg.expiresAt === 0);
  if (isPermShare) {
    const hasTop = Boolean(pkg._hasTopPremiumActiveUntil || pkg._topPremiumActiveUntil !== undefined);
    const premUntil = hasTop
      ? (Number(pkg._topPremiumActiveUntil) || 0)
      : (Number(pkg.premiumActiveUntil) || 0);
    const cfg = typeof this.getSubscriptionQuotaConfig === 'function' ? this.getSubscriptionQuotaConfig() : null;
    const graceDays = (cfg && Number(cfg.premiumShareGraceDays)) || 7;
    const graceMs = graceDays * 24 * 60 * 60 * 1000;
    if ((hasTop && premUntil <= 0) || (premUntil > 0 && Date.now() > (premUntil + graceMs))) {
      // 데이터 삭제 없이 일시잠금 안내만 표시 (작성자 재구독 시 동일 링크/QR 즉시 복구!)
      this.showPermanentShareLockedModal(graceDays);
      return;
    }
    if ((!Array.isArray(pkg.playlistSlides) || !pkg.playlistSlides.length) && (pkg._isChunked || pkg._isVaultPointer)) {
      pkg = await this._resolveChunkedItem(pkg, 'shared_workspaces', forceFreshVaultFetch);
    }
  } else {
    const expDays = Number(pkg.shareExpiryDays) || 7;
    const exp = Number(pkg.expiresAt) || ((pkg.createdAt || 0) + expDays * 24 * 60 * 60 * 1000);
    if (pkg.createdAt && Date.now() > exp) {
      await purgeLocalShareCaches(pkg);
      if (!pkg._isVaultPointer && !pkg._fromVaultPointer) {
        await this._cleanupCloudItemChunks(pkg).catch(() => { });
      }
      this._firestoreRestDeleteDoc('shared_workspaces', shortId).catch(() => { });
      this.showToast(`⏰ 유효기간(${expDays}일)이 만료된 공유 링크입니다.`);
      return;
    }
  }

  if (!pkg || !Array.isArray(pkg.playlistSlides) || !pkg.playlistSlides.length) {
    this.showToast('⚠️ 공유된 수업 데이터를 불러올 수 없습니다.');
    return;
  }

  this._initialSharedCloudPkg = JSON.parse(JSON.stringify(pkg));
  this.applyCloudSharePackage(pkg);

  // 🌟 [대표님 핵심 기획]: 공유 링크를 열면 기기(폰·폴드·패드·PC) 불문 먼저 깔끔한 직사각형 스캔 이미지 뷰어로 오픈!
  // 이미지 속 그래프(#1, #2)를 누르면 즉시 그래프 조작으로 이동하고, [✏️ 편집하기]를 누르면 전체 칠판 편집으로 전환!
  await this.openSmartNoteViewer(pkg);
}

// ============================================================================
// 🖼️ [Graphly 표준 뷰어: 툭 터치 전체화면 · 좌우 스와이프 페이지 넘김 · 확대/축소 · 그래프 원터치 조작]
// ============================================================================
_initSmartNoteViewerEvents() {
  if (this._smartViewerEventsBound) return;
  this._smartViewerEventsBound = true;

  this._viewerZoom = 1.0;
  this._viewerPanX = 0;
  this._viewerPanY = 0;
  this._viewerSlideIdx = 0;
  this._viewerPkg = null;

  const overlay = document.getElementById('smartNoteViewerOverlay');
  const viewport = document.getElementById('smartNoteViewerViewport');
  const stage = document.getElementById('smartNoteViewerStage');
  const btnPrev = document.getElementById('btnViewerPrevSlide');
  const btnNext = document.getElementById('btnViewerNextSlide');
  const btnEdgePrev = document.getElementById('btnViewerEdgePrev');
  const btnEdgeNext = document.getElementById('btnViewerEdgeNext');
  const btnCounter = document.getElementById('btnViewerSlideCounter');
  const gridPopover = document.getElementById('viewerSlideGridPopover');
  const btnZoomIn = document.getElementById('btnViewerZoomIn');
  const btnZoomOut = document.getElementById('btnViewerZoomOut');
  const btnZoomFit = document.getElementById('btnViewerZoomFit');
  const btnDownload = document.getElementById('btnViewerDownloadPng');
  const btnWatchVideo = document.getElementById('btnViewerWatchVideo');
  const btnEdit = document.getElementById('btnViewerEnterEdit');
  const btnFullscreen = document.getElementById('btnViewerFullscreen');

  const btnTouchReset = document.getElementById('btnViewerGraphReset');
  const btnTouchBack = document.getElementById('btnViewerGraphBackToViewer');

  const goPrevSlide = (e) => {
    if (e) e.stopPropagation();
    if (this._viewerPkg && this._viewerSlideIdx > 0) {
      this.switchSmartViewerSlide(this._viewerSlideIdx - 1, 'prev');
    }
  };
  const goNextSlide = (e) => {
    if (e) e.stopPropagation();
    if (this._viewerPkg && this._viewerSlideIdx < this._viewerPkg.playlistSlides.length - 1) {
      this.switchSmartViewerSlide(this._viewerSlideIdx + 1, 'next');
    }
  };

  if (btnPrev) btnPrev.onclick = goPrevSlide;
  if (btnNext) btnNext.onclick = goNextSlide;
  if (btnEdgePrev) btnEdgePrev.onclick = goPrevSlide;
  if (btnEdgeNext) btnEdgeNext.onclick = goNextSlide;
  if (btnCounter && gridPopover) {
    btnCounter.onclick = (e) => {
      e.stopPropagation();
      const total = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) ? this._viewerPkg.playlistSlides.length : 1;
      if (total <= 1) return;
      const isOpen = gridPopover.style.display !== 'none';
      gridPopover.style.display = isOpen ? 'none' : 'block';
    };
    window.addEventListener('pointerdown', (ev) => {
      if (gridPopover.style.display === 'none') return;
      if (ev.target && ev.target.closest && (ev.target.closest('#viewerSlideGridPopover') || ev.target.closest('#btnViewerSlideCounter'))) return;
      gridPopover.style.display = 'none';
    }, { capture: true });
  }
  if (btnZoomIn) {
    btnZoomIn.onclick = () => {
      const nextZ = Math.round(((this._viewerZoom || 1.0) + 0.10) * 100) / 100;
      this.setSmartViewerZoom(nextZ);
    };
  }
  if (btnZoomOut) {
    btnZoomOut.onclick = () => {
      const nextZ = Math.round(((this._viewerZoom || 1.0) - 0.10) * 100) / 100;
      this.setSmartViewerZoom(nextZ);
    };
  }
  if (btnZoomFit) {
    btnZoomFit.onclick = () => this.fitSmartViewerStageToScreen();
  }
  if (btnDownload) {
    btnDownload.onclick = async () => {
      if (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides) && this._viewerPkg.playlistSlides.length >= 1) {
        await this.downloadViewerSlidesAsSinglePdf(this._viewerPkg);
        return;
      }
      const img = document.getElementById('smartNoteViewerImg');
      if (!img || !img.src) return;
      const link = document.createElement('a');
      link.download = `Graphly_판서노트_${this._viewerSlideIdx + 1}_${Date.now()}.png`;
      link.href = img.src;
      link.click();
    };
  }
  if (btnWatchVideo) {
    btnWatchVideo.onclick = (e) => {
      e.stopPropagation();
      this.enterAudioLectureFromViewer(this._viewerSlideIdx);
    };
  }
  if (btnEdit) {
    btnEdit.onclick = () => {
      this.exitSmartNoteViewerToEditMode();
    };
  }
  if (btnFullscreen) {
    btnFullscreen.onclick = (e) => {
      e.stopPropagation();
      this.toggleSmartViewerFullscreen(true);
    };
  }

  const fsGate = document.getElementById('viewerFullscreenGate');
  const btnFsGateStart = document.getElementById('btnViewerFullscreenGateStart');
  const handleEnterFromFsGate = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (overlay) overlay.classList.remove('viewer-entry-gate-active');
    if (fsGate) fsGate.style.display = 'none';
    this._mobileViewerFsAttempted = true;
    this.toggleSmartViewerImmersiveMode(true, true);
    this.fitSmartViewerStageToScreen(true);
    setTimeout(() => {
      if (overlay && overlay.style.display !== 'none' && (this._viewerZoom || 1.0) <= 1.02) {
        this.fitSmartViewerStageToScreen(true);
      }
    }, 160);
    const total = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) ? this._viewerPkg.playlistSlides.length : 1;
    if (total > 1) {
      this._flashViewerFloatingPageToast(this._viewerSlideIdx || 0, total);
    }
  };
  if (btnFsGateStart) {
    btnFsGateStart.onclick = handleEnterFromFsGate;
  }
  if (fsGate) {
    fsGate.onclick = handleEnterFromFsGate;
  }

  const syncFullscreenIcons = () => {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement || (overlay && overlay.classList.contains('viewer-immersive-fullscreen')));
    const icEnter = document.getElementById('iconViewerFullscreenEnter');
    const icExit = document.getElementById('iconViewerFullscreenExit');
    if (icEnter) icEnter.style.display = isFs ? 'none' : '';
    if (icExit) icExit.style.display = isFs ? '' : 'none';
    if (overlay && overlay.style.display !== 'none' && (this._viewerZoom || 1.0) <= 1.02) {
      this.fitSmartViewerStageToScreen(true);
    }
  };
  document.addEventListener('fullscreenchange', syncFullscreenIcons);
  document.addEventListener('webkitfullscreenchange', syncFullscreenIcons);
  window.addEventListener('resize', () => {
    if (overlay && overlay.style.display !== 'none') {
      if ((this._viewerZoom || 1.0) <= 1.02) {
        this.fitSmartViewerStageToScreen(true);
      } else {
        this._clampSmartViewerPan();
        this._applySmartViewerTransform();
      }
    }
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (overlay && overlay.style.display !== 'none') {
        this.fitSmartViewerStageToScreen(true);
      }
    }, 120);
  });

  // 키보드 좌우 방향키 페이지 넘김 & 단축키 지원
  window.addEventListener('keydown', (e) => {
    if (!overlay || overlay.style.display === 'none') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      if (this._viewerPkg && this._viewerSlideIdx > 0) {
        e.preventDefault();
        this.switchSmartViewerSlide(this._viewerSlideIdx - 1, 'prev');
      }
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      if (this._viewerPkg && this._viewerSlideIdx < this._viewerPkg.playlistSlides.length - 1) {
        e.preventDefault();
        this.switchSmartViewerSlide(this._viewerSlideIdx + 1, 'next');
      }
    } else if (e.key === 'Escape') {
      if (overlay.classList.contains('viewer-immersive-fullscreen')) {
        overlay.classList.remove('viewer-immersive-fullscreen');
        syncFullscreenIcons();
      }
    } else if (e.key === '0') {
      this.fitSmartViewerStageToScreen();
    }
  });

  if (btnTouchReset) {
    btnTouchReset.onclick = () => {
      if (this._activeViewerHotspot && this._activeViewerHotspot.graphSnapshot) {
        this.applyPureGraphSnapshot(this._activeViewerHotspot.graphSnapshot);
        const hasLoadedGraphInk = Array.isArray(this.inkStrokes) && this.inkStrokes.some(s => s && s.target === 'graph');
        if (!hasLoadedGraphInk && typeof this._resolveFallbackViewerHotspotGraphInk === 'function') {
          const fallbackStrokes = this._resolveFallbackViewerHotspotGraphInk(this._activeViewerHotspot, this._viewerSlideIdx || 0);
          if (Array.isArray(fallbackStrokes) && fallbackStrokes.length > 0) {
            if (!Array.isArray(this.inkStrokes)) this.inkStrokes = [];
            this.inkStrokes.push(...fallbackStrokes);
          }
        }
        this.autoCenterGraphForTouchViewer(this._activeViewerHotspot.graphSnapshot);
        this._inkBakeDirty = true;
        if (typeof this.clearInkCache === 'function') this.clearInkCache();
        this._renderViewerGraphCurveChips();
        this.render();
      }
    };
  }
  if (btnTouchBack) {
    btnTouchBack.onclick = () => {
      this.exitViewerGraphTouchModeToViewer();
    };
  }

  if (viewport) {
    const activePointers = new Map();
    let dragStartX = 0, dragStartY = 0;
    let panStartX = 0, panStartY = 0;
    let startAtLeftEdge = false, startAtRightEdge = false;
    let pointerDownTime = 0;
    let lastMoveX = 0, lastMoveTime = 0, velocityX = 0;
    let wasMultiTouch = false;
    let pinchStartDist = 0;
    let pinchStartZoom = 1.0;
    let pinchStartPanX = 0, pinchStartPanY = 0;
    let pinchStartMidX = 0, pinchStartMidY = 0;
    let lastTapTime = 0;
    let lastTapX = 0, lastTapY = 0;
    let singleTapTimer = null;

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._commitPendingViewerCarouselImmediately();
      this._setSmartViewerCarouselAnimating(false);
      // PC 마우스 휠 및 트랙패드 핀치: 첫 화면(100%)부터 확대 상태까지 언제나 커서 위치 기준 즉시 확대/축소!
      const step = (e.ctrlKey || e.metaKey) ? 1.08 : 1.11;
      const factor = e.deltaY < 0 ? step : (1 / step);
      this.setSmartViewerZoom((this._viewerZoom || 1.0) * factor, e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener('pointerdown', (e) => {
      // 좌우 가장자리 화살표 버튼 클릭만 예외 처리하고, 그래프/스티커 핫스팟 위에서도 스와이프·핀치 줌 100% 허용!
      if (e.target.closest('.viewer-edge-nav-btn')) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this._commitPendingViewerCarouselImmediately();
      this._setSmartViewerCarouselAnimating(false);

      // 모바일 첫 터치 시 브라우저 주소창을 가리는 네이티브 전체화면 자동 진입 시도 (안드로이드 크롬 등 지원 기기)
      if (e.pointerType === 'touch' && !this._mobileViewerFsAttempted && (window.innerWidth <= 768 || window.innerHeight <= 500)) {
        this._mobileViewerFsAttempted = true;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const docEl = document.documentElement;
          const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
          if (typeof req === 'function') {
            try {
              const p = req.call(docEl);
              if (p && typeof p.catch === 'function') p.catch(() => { });
            } catch (_) { }
          }
        }
      }

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 1) {
        wasMultiTouch = false;
        pointerDownTime = performance.now();
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        lastMoveX = e.clientX;
        lastMoveTime = pointerDownTime;
        velocityX = 0;
        panStartX = this._viewerPanX || 0;
        panStartY = this._viewerPanY || 0;
        const zoom = this._viewerZoom || 1.0;
        const vw = Math.max(200, viewport.clientWidth);
        const zoomedW = (this._viewerBaseW || 1000) * zoom;
        const maxPanX = Math.max(0, (zoomedW - vw) / 2);
        startAtLeftEdge = (panStartX >= maxPanX - 6);
        startAtRightEdge = (panStartX <= -maxPanX + 6);
      } else if (activePointers.size === 2) {
        wasMultiTouch = true;
        this._viewerSuppressHotspotClickUntil = performance.now() + 350;
        if (singleTapTimer) {
          clearTimeout(singleTapTimer);
          singleTapTimer = null;
        }
        const pts = Array.from(activePointers.values());
        pinchStartDist = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        pinchStartMidX = (pts[0].x + pts[1].x) / 2;
        pinchStartMidY = (pts[0].y + pts[1].y) / 2;
        pinchStartZoom = this._viewerZoom || 1.0;
        pinchStartPanX = this._viewerPanX || 0;
        pinchStartPanY = this._viewerPanY || 0;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 2) {
        this._viewerSuppressHotspotClickUntil = performance.now() + 350;
        const pts = Array.from(activePointers.values());
        const dist = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const nextZoom = Math.max(1.0, Math.min(3.0, pinchStartZoom * (dist / pinchStartDist)));
        const rect = viewport.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const scaleRatio = nextZoom / Math.max(0.1, pinchStartZoom);

        this._viewerZoom = nextZoom;
        this._viewerPanX = (midX - cx) - ((pinchStartMidX - cx - pinchStartPanX) * scaleRatio);
        this._viewerPanY = (midY - cy) - ((pinchStartMidY - cy - pinchStartPanY) * scaleRatio);
        this._clampSmartViewerPan();
        this._applySmartViewerTransform();
        return;
      }

      if (activePointers.size === 1 && !wasMultiTouch) {
        const now = performance.now();
        const dt = Math.max(1, now - lastMoveTime);
        velocityX = (e.clientX - lastMoveX) / dt;
        lastMoveX = e.clientX;
        lastMoveTime = now;

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.hypot(dx, dy) >= 8) {
          this._viewerSuppressHotspotClickUntil = now + 280;
        }
        if ((this._viewerZoom || 1.0) <= 1.02) {
          // 기본 배율(100%): 1:1 쫀득한 좌우 캐러셀 스와이프 페이지 넘김 프리뷰 (옆 페이지 동시 슬라이딩)
          if (Math.abs(dx) > 3) {
            const total = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) ? this._viewerPkg.playlistSlides.length : 1;
            const atEdge = (dx > 0 && this._viewerSlideIdx <= 0) || (dx < 0 && this._viewerSlideIdx >= total - 1);
            this._viewerPanX = dx * (atEdge ? 0.22 : 1.0);
            this._viewerPanY = 0;
            this._applySmartViewerTransform();
          }
        } else {
          // 확대 상태(>100%): 경계 이탈 없는 부드러운 2D 패닝
          this._viewerPanX = panStartX + dx;
          this._viewerPanY = panStartY + dy;
          this._clampSmartViewerPan();
          this._applySmartViewerTransform();
        }
      }
    });

    const handlePointerFinish = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);

      if (activePointers.size > 0) return;

      const totalDx = e.clientX - dragStartX;
      const totalDy = e.clientY - dragStartY;
      const moveDist = Math.hypot(totalDx, totalDy);
      const elapsed = performance.now() - pointerDownTime;

      if (wasMultiTouch) {
        wasMultiTouch = false;
        if ((this._viewerZoom || 1.0) < 1.0) {
          this.fitSmartViewerStageToScreen(true);
        } else {
          this._clampSmartViewerPan();
          this._applySmartViewerTransform();
        }
        return;
      }

      // 1) 툭 터치(Single Tap) vs 더블탭(Double Tap) 판별
      if (moveDist < 8 && elapsed < 380) {
        // 그래프/스티커 핫스팟 위를 툭 탭한 경우는 핫스팟 고유 클릭 동작에 위임
        if (e.target && e.target.closest && e.target.closest('.viewer-graph-hotspot, .viewer-sticker-hotspot')) {
          return;
        }
        const now = performance.now();
        if (now - lastTapTime < 280 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 36) {
          // 더블탭: 터치한 지점 중심으로 100% ⇄ 180% 즉시 확대/축소 토글
          if (singleTapTimer) {
            clearTimeout(singleTapTimer);
            singleTapTimer = null;
          }
          lastTapTime = 0;
          if (stage) stage.classList.add('swipe-animating');
          if ((this._viewerZoom || 1.0) > 1.08) {
            this.fitSmartViewerStageToScreen(true);
          } else {
            this.setSmartViewerZoom(1.8, e.clientX, e.clientY);
          }
          return;
        }
        lastTapTime = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
        if (singleTapTimer) clearTimeout(singleTapTimer);
        singleTapTimer = setTimeout(() => {
          singleTapTimer = null;
          // 문서 크기는 1px도 흔들지 않고 상단 바만 부드럽게 숨김/표시 토글
          this.toggleSmartViewerImmersiveMode(null, false);
        }, 210);
        return;
      }

      const total = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) ? this._viewerPkg.playlistSlides.length : 1;
      const isHorizSwipe = Math.abs(totalDx) > Math.abs(totalDy) * 0.92;
      const isFastFlickNext = (totalDx <= -18 && velocityX <= -0.22);
      const isFastFlickPrev = (totalDx >= 18 && velocityX >= 0.22);

      // 2) 기본 배율(100%)에서 좌우 스와이프(또는 빠른 플릭) 시 이전/다음 페이지 즉시 넘김!
      if ((this._viewerZoom || 1.0) <= 1.02) {
        if (isHorizSwipe && (totalDx <= -26 || isFastFlickNext) && this._viewerSlideIdx < total - 1) {
          this.switchSmartViewerSlide(this._viewerSlideIdx + 1, 'next', velocityX);
          return;
        }
        if (isHorizSwipe && (totalDx >= 26 || isFastFlickPrev) && this._viewerSlideIdx > 0) {
          this.switchSmartViewerSlide(this._viewerSlideIdx - 1, 'prev', velocityX);
          return;
        }
        this._setSmartViewerCarouselAnimating(true, 320);
        this._viewerPanX = 0;
        this._viewerPanY = 0;
        this._applySmartViewerTransform();
        return;
      }

      // 3) 확대 상태(>100%)에서도 좌/우 끝단에 닿은 채로 한 번 더 밀면(Edge Swipe) 다음/이전 페이지로 전환!
      if (isHorizSwipe) {
        if (startAtRightEdge && (totalDx <= -44 || isFastFlickNext) && this._viewerSlideIdx < total - 1) {
          this.switchSmartViewerSlide(this._viewerSlideIdx + 1, 'next', velocityX);
          return;
        }
        if (startAtLeftEdge && (totalDx >= 44 || isFastFlickPrev) && this._viewerSlideIdx > 0) {
          this.switchSmartViewerSlide(this._viewerSlideIdx - 1, 'prev', velocityX);
          return;
        }
      }
    };

    window.addEventListener('pointerup', handlePointerFinish);
    window.addEventListener('pointercancel', handlePointerFinish);
  }
}

toggleSmartViewerImmersiveMode(forceState = null, requestNativeFs = false) {
  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (!overlay) return;
  const nextImmersive = typeof forceState === 'boolean'
    ? forceState
    : !overlay.classList.contains('viewer-immersive-fullscreen');
  overlay.classList.toggle('viewer-immersive-fullscreen', nextImmersive);

  // 우상단 [⛶ 전체화면] 버튼을 명시적으로 눌렀을 때만 브라우저 네이티브 전체화면 요청 (일반 탭 시 화면 깜빡임/리사이즈 0%)
  if (requestNativeFs && nextImmersive && !document.fullscreenElement && !document.webkitFullscreenElement) {
    const docEl = document.documentElement;
    const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
    if (typeof req === 'function') {
      try {
        const p = req.call(docEl);
        if (p && typeof p.catch === 'function') p.catch(() => { });
      } catch (_) { }
    }
  }

  const icEnter = document.getElementById('iconViewerFullscreenEnter');
  const icExit = document.getElementById('iconViewerFullscreenExit');
  const isFs = Boolean(nextImmersive || document.fullscreenElement || document.webkitFullscreenElement);
  if (icEnter) icEnter.style.display = isFs ? 'none' : '';
  if (icExit) icExit.style.display = isFs ? '' : 'none';
}

toggleSmartViewerFullscreen(fromButton = false) {
  const overlay = document.getElementById('smartNoteViewerOverlay');
  const isNativeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const isImmersive = Boolean(overlay && overlay.classList.contains('viewer-immersive-fullscreen'));

  if (isNativeFs) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (typeof exit === 'function') {
      try {
        const p = exit.call(document);
        if (p && typeof p.catch === 'function') p.catch(() => { });
      } catch (_) { }
    }
    if (overlay) overlay.classList.remove('viewer-immersive-fullscreen');
    return;
  }

  if (fromButton && isImmersive) {
    overlay.classList.remove('viewer-immersive-fullscreen');
    return;
  }

  this.toggleSmartViewerImmersiveMode(true, Boolean(fromButton));
}

_flashViewerFloatingPageToast(idx, total) {
  const toast = document.getElementById('viewerFloatingPageToast');
  if (!toast || total <= 1) {
    if (toast) toast.style.display = 'none';
    return;
  }
  toast.textContent = `${idx + 1} / ${total}`;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  if (this._viewerPageToastTimer) clearTimeout(this._viewerPageToastTimer);
  this._viewerPageToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.style.opacity === '0') toast.style.display = 'none';
    }, 200);
  }, 1100);
}

  async enterStudentAudioVideoOnlyMode(pkg, autoPlay = false, options = null) {
  if (!pkg) return;
  this._clearSmartViewerPreloadedImages();
  if (typeof this._ensureCloudShareAudioLoaded === 'function') {
    await this._ensureCloudShareAudioLoaded(pkg);
  }
  const slides = Array.isArray(pkg.playlistSlides) && pkg.playlistSlides.length > 0
    ? pkg.playlistSlides
    : (pkg.slideData ? [pkg.slideData] : (pkg.historyJson ? [pkg] : []));
  if (!slides.length) return;

  const effMode = (options && options.mode === 'note') ? 'note' : 'video';

  this.isStudentAudioVideoOnlyMode = true;
  if (this.virtualStylusEl) {
    this.virtualStylusEl.style.display = 'none';
  }
  document.body.classList.add('student-audio-video-only');
  document.body.classList.remove('viewer-graph-touch-mode');

  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (overlay) overlay.style.display = 'none';
  const touchBar = document.getElementById('viewerGraphTouchBar');
  if (touchBar) touchBar.style.display = 'none';
  const resetBar = document.getElementById('sharedResetBar');
  if (resetBar) resetBar.style.display = 'none';

  const normalizedPkg = {
    ...pkg,
    playlistSlides: slides,
    isPlaylist: slides.length > 1 || Boolean(pkg.isPlaylist),
    currentIndex: Math.max(0, Math.min(slides.length - 1, pkg.currentIndex || 0))
  };
  this._viewerPkg = normalizedPkg;

  // 🌟 [핵심 핀셋 수정: 1페이지(첫 슬라이드) 진입 시에도 2페이지와 100% 동일하게 고정 스테이지(replay-fixed-stage)를 먼저 켠 뒤 이미지를 로드·래스터화!]
  this._isAudioSyncPlayerVisible = true;
  this.audioReplayViewMode = effMode;
  this._replayViewerZoom = 1.0;
  this._replayViewerPanX = 0;
  this._replayViewerPanY = 0;
  this._lastAppliedAudioStateObj = null;
  this._replayInkBakeKey = '';
  this._isAudioReplayActive = true;
  document.body.classList.add('audio-replay-active');
  const targetInitialSlide = slides[normalizedPkg.currentIndex] || slides[0];
  if (targetInitialSlide && targetInitialSlide.audioSyncData) {
    this.audioSyncData = this._expandAudioSyncData(JSON.parse(JSON.stringify(targetInitialSlide.audioSyncData)));
  }
  if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();

  this.applyCloudSharePackage(normalizedPkg);
  await this._waitForSlideImagesReady();

  const maxDur = (this.audioSyncData && Number(this.audioSyncData.durationMs) > 0)
    ? Number(this.audioSyncData.durationMs)
    : 0;
  const rawStartMs = (options && typeof options.startMs === 'number' && Number.isFinite(options.startMs))
    ? options.startMs
    : 0;
  const safeStartMs = Math.max(0, maxDur > 0 ? Math.min(maxDur, rawStartMs) : rawStartMs);

  this._isAudioSyncPlayerVisible = true;
  this.audioReplayViewMode = effMode;
  this._isAudioReplayActive = true;
  document.body.classList.add('audio-replay-active');
  if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();
  this._applyAudioTimelineStateAt(safeStartMs);
  this.updateProblemCardPosition();
  this.syncProblemCardRectFromWidget();
  this.syncGraphCardRectFromWidget();
  if (typeof this._refreshProblemCardImagesForReplayStage === 'function') {
    this._refreshProblemCardImagesForReplayStage();
  }
  if (autoPlay) {
    this.playAudioSync(safeStartMs, effMode);
  } else {
    this.pauseAudioPlayback(false);
    this.audioPlayCurrentMs = safeStartMs;
    this._renderAudioReplayAtCurrentTime();
    this.syncAudioRecordUI();
  }
  this.syncLessonPlaylistNavBarUI();
}

exitStudentAudioVideoOnlyMode() {
  this.isStudentAudioVideoOnlyMode = false;
  this._isAudioSyncPlayerVisible = false;
  document.body.classList.remove('student-audio-video-only');
  if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();
  if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
}

  async openCurrentWorkspaceInSmartViewer() {
  if (!this.isDrawerCollapsed && typeof this.closeDrawer === 'function') {
    this.closeDrawer();
  }
  if (this.isAudioRecording) {
    await this.stopAudioRecording();
  } else if (this._pendingSlideAudioFinalizers && this._pendingSlideAudioFinalizers.length > 0) {
    await Promise.all(this._pendingSlideAudioFinalizers).catch(() => { });
    this._pendingSlideAudioFinalizers = [];
  }
  if (this.isLessonPlaylistActive && Array.isArray(this.lessonPlaylistSlides) && this.lessonPlaylistSlides.length > 0) {
    this.saveCurrentSlideIntoPlaylist();
  }
  const rawSlides = this._getActiveSlidesForExport('수업 노트');
  if (!rawSlides || !rawSlides.length) return;

  const previewSlides = JSON.parse(JSON.stringify(rawSlides)).map(s => {
    if (s) {
      delete s.viewerSnapshotDataUrl;
      delete s.viewerGraphHotspots;
      delete s.viewerStickerHotspots;
      delete s.viewerSmartBounds;
    }
    return s;
  });

  const activeIdx = (this.isLessonPlaylistActive && typeof this.lessonPlaylistIndex === 'number')
    ? Math.max(0, Math.min(previewSlides.length - 1, this.lessonPlaylistIndex))
    : 0;

  const pkg = {
    id: 'preview_' + Date.now().toString(36),
    createdAt: Date.now(),
    _isLocalPreview: true,
    promoBanner: this.getEffectiveSharePromoBanner(),
    exportScope: previewSlides.length > 1 ? 'all' : 'current',
    exportFilter: { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true },
    isPlaylist: Boolean(this.isLessonPlaylistActive) || previewSlides.length > 1,
    playlistSlides: previewSlides,
    currentIndex: activeIdx
  };

  await this.openSmartNoteViewer(pkg, true);
}

_putViewerPreloadedImageBounded(dataUrl, maxEntries = 8) {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl === '__SAME_AS_PDF_BOARD__') return;
  if (!this._viewerPreloadedImages) this._viewerPreloadedImages = new Map();
  if (this._viewerPreloadedImages.has(dataUrl)) {
    const existing = this._viewerPreloadedImages.get(dataUrl);
    this._viewerPreloadedImages.delete(dataUrl);
    this._viewerPreloadedImages.set(dataUrl, existing);
    return;
  }
  while (this._viewerPreloadedImages.size >= maxEntries) {
    const oldestKey = this._viewerPreloadedImages.keys().next().value;
    if (oldestKey === undefined) break;
    const oldImg = this._viewerPreloadedImages.get(oldestKey);
    this._viewerPreloadedImages.delete(oldestKey);
    if (oldImg) {
      try {
        oldImg.onload = null;
        oldImg.onerror = null;
        oldImg.src = '';
      } catch (_) { }
    }
  }
  const im = new Image();
  im.decoding = 'async';
  im.src = dataUrl;
  this._viewerPreloadedImages.set(dataUrl, im);
}

_clearSmartViewerPreloadedImages() {
  if (!this._viewerPreloadedImages) return;
  for (const im of this._viewerPreloadedImages.values()) {
    if (im) {
      try {
        im.onload = null;
        im.onerror = null;
        im.src = '';
      } catch (_) { }
    }
  }
  this._viewerPreloadedImages.clear();
}

_preloadSmartViewerSlides(pkg, centerIdx = null) {
  if (!pkg || !Array.isArray(pkg.playlistSlides) || !pkg.playlistSlides.length) return;
  const slides = pkg.playlistSlides;
  const baseIdx = Math.max(0, Math.min(slides.length - 1, typeof centerIdx === 'number' ? centerIdx : (pkg.currentIndex || 0)));
  const offsets = [3, -2, 2, -1, 1, 0];
  for (let i = 0; i < offsets.length; i++) {
    const idx = baseIdx + offsets[i];
    if (idx < 0 || idx >= slides.length) continue;
    const sl = slides[idx];
    if (sl && sl.viewerSnapshotDataUrl && sl.viewerSnapshotDataUrl !== '__SAME_AS_PDF_BOARD__') {
      this._putViewerPreloadedImageBounded(sl.viewerSnapshotDataUrl, 8);
    }
  }
}

_setSmartViewerCarouselAnimating(enabled, durationMs = 400) {
  const ids = ['smartNoteViewerStage', 'smartNoteViewerPrevStage', 'smartNoteViewerNextStage'];
  const durStr = `${Math.max(180, Math.round(durationMs || 400))}ms`;
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (enabled) {
      el.style.setProperty('--viewer-swipe-dur', durStr);
      el.classList.add('swipe-animating');
    } else {
      el.classList.remove('swipe-animating');
    }
  });
}

_commitPendingViewerCarouselImmediately() {
  if (this._viewerCarouselTimer) {
    clearTimeout(this._viewerCarouselTimer);
    this._viewerCarouselTimer = null;
  }
  if (typeof this._viewerPendingCarouselCommit === 'function') {
    const fn = this._viewerPendingCarouselCommit;
    this._viewerPendingCarouselCommit = null;
    fn();
  }
}

_calcSmartViewerFitSize(iw, ih, viewport = null) {
  const vp = viewport || document.getElementById('smartNoteViewerViewport');
  const isMobileViewport = (typeof window !== 'undefined') && (window.innerWidth <= 768 || window.innerHeight <= 500);
  const padX = isMobileViewport ? 0 : 20;
  const padY = isMobileViewport ? 0 : 56;
  const vw = Math.max(180, ((vp && vp.clientWidth) ? vp.clientWidth : window.innerWidth) - padX);
  const vh = Math.max(160, ((vp && vp.clientHeight) ? vp.clientHeight : window.innerHeight) - padY);
  const safeW = Math.max(1, iw || 1000);
  const safeH = Math.max(1, ih || 700);
  const fitScale = Math.min(vw / safeW, vh / safeH);
  const displayW = Math.max(2, Math.round((safeW * fitScale) / 2) * 2);
  const displayH = Math.max(2, Math.round((safeH * fitScale) / 2) * 2);
  return { displayW, displayH };
}

_getSmartViewerSlideStride(viewport = null, neighborWOverride = null) {
  const vp = viewport || document.getElementById('smartNoteViewerViewport');
  const vw = Math.max(280, (vp && vp.clientWidth) ? vp.clientWidth : window.innerWidth);
  const currW = Math.max(200, this._viewerBaseW || vw);
  const neighborW = Math.max(200, neighborWOverride || currW);
  const pageGap = ((typeof window !== 'undefined') && window.innerWidth <= 768) ? 14 : 22;
  // 정지 상태(px=0)에서는 옆 페이지가 뷰포트 가장자리 바로 4px 밖에 숨어 대기하고,
  // 손가락을 5px만 밀어도 즉시 화면 끝에서부터 부드럽게 고개를 내밀도록 최소 간격으로 밀착 배치!
  const minByPages = Math.round((currW + neighborW) / 2) + pageGap;
  const minByViewportEdge = Math.round((vw + neighborW) / 2) + 4;
  return Math.max(minByPages, minByViewportEdge);
}

  async _ensureSlideViewerSnapshot(slide) {
  if (!slide) return;
  if (slide.viewerSnapshotDataUrl === '__SAME_AS_PDF_BOARD__') {
    this._applyFastPdfBoardViewerSnapshot(slide);
  } else if (!slide.viewerSnapshotDataUrl) {
    const effFilter = (this._viewerPkg && this._viewerPkg.exportFilter) || null;
    if (this._isPureUnannotatedPdfPageSlide(slide, effFilter)) {
      this._applyFastPdfBoardViewerSnapshot(slide);
    } else {
      this.deserializeFullSlideState(slide);
      await this._waitForSlideImagesReady();
      const snap = this.captureCurrentSlideViewerSnapshot(effFilter, false);
      slide.viewerSnapshotDataUrl = snap.dataUrl;
      slide.viewerSnapshotWidth = snap.width;
      slide.viewerSnapshotHeight = snap.height;
      slide.viewerGraphHotspots = snap.hotspots;
      slide.viewerStickerHotspots = snap.stickerHotspots;
      slide.viewerSmartBounds = snap.smartBounds;
      slide._viewerHiResRendered = true;
    }
  }
  if (slide.viewerSnapshotDataUrl) {
    this._putViewerPreloadedImageBounded(slide.viewerSnapshotDataUrl, 8);
  }
}

_syncSmartViewerNeighborStages(centerIdx = this._viewerSlideIdx) {
  const viewport = document.getElementById('smartNoteViewerViewport');
  const prevStage = document.getElementById('smartNoteViewerPrevStage');
  const prevImg = document.getElementById('smartNoteViewerPrevImg');
  const nextStage = document.getElementById('smartNoteViewerNextStage');
  const nextImg = document.getElementById('smartNoteViewerNextImg');
  const slides = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) ? this._viewerPkg.playlistSlides : [];

  const bindNeighborStage = (stageEl, imgEl, neighborSlide) => {
    if (!stageEl || !imgEl) return;
    if (neighborSlide && neighborSlide.viewerSnapshotDataUrl) {
      stageEl.dataset.ready = '1';
      if (imgEl.src !== neighborSlide.viewerSnapshotDataUrl) {
        imgEl.onload = () => {
          const fit = this._calcSmartViewerFitSize(
            neighborSlide.viewerSnapshotWidth || imgEl.naturalWidth || this._viewerBaseW || 1000,
            neighborSlide.viewerSnapshotHeight || imgEl.naturalHeight || this._viewerBaseH || 700,
            viewport
          );
          stageEl.dataset.fitW = String(fit.displayW);
          imgEl.style.width = `${fit.displayW}px`;
          imgEl.style.height = `${fit.displayH}px`;
        };
        imgEl.src = neighborSlide.viewerSnapshotDataUrl;
      }
      const fit = this._calcSmartViewerFitSize(
        neighborSlide.viewerSnapshotWidth || imgEl.naturalWidth || this._viewerBaseW || 1000,
        neighborSlide.viewerSnapshotHeight || imgEl.naturalHeight || this._viewerBaseH || 700,
        viewport
      );
      stageEl.dataset.fitW = String(fit.displayW);
      imgEl.style.width = `${fit.displayW}px`;
      imgEl.style.height = `${fit.displayH}px`;
    } else {
      stageEl.dataset.ready = '0';
      stageEl.dataset.fitW = '';
      stageEl.style.display = 'none';
    }
  };

  bindNeighborStage(prevStage, prevImg, centerIdx > 0 ? slides[centerIdx - 1] : null);
  bindNeighborStage(nextStage, nextImg, centerIdx < slides.length - 1 ? slides[centerIdx + 1] : null);
  this._applySmartViewerTransform();
}

  async _prewarmNeighborSlideSnapshots(centerIdx) {
  if (!this._viewerPkg || !Array.isArray(this._viewerPkg.playlistSlides)) return;
  const slides = this._viewerPkg.playlistSlides;
  if (slides.length <= 1) return;
  const token = (this._viewerPrewarmToken = (this._viewerPrewarmToken || 0) + 1);
  const neighborIndices = [centerIdx + 1, centerIdx - 1].filter(i => i >= 0 && i < slides.length);
  const missing = neighborIndices.filter(i => slides[i] && !slides[i].viewerSnapshotDataUrl);
  if (!missing.length) return;

  await new Promise(r => setTimeout(r, 40));
  if (this._viewerPrewarmToken !== token) return;
  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (!overlay || overlay.style.display === 'none' || document.body.classList.contains('viewer-graph-touch-mode') || this._isAudioReplayActive) return;

  let generatedAny = false;
  for (const nIdx of missing) {
    if (this._viewerPrewarmToken !== token) return;
    if (!overlay || overlay.style.display === 'none' || document.body.classList.contains('viewer-graph-touch-mode') || this._isAudioReplayActive) return;
    await this._ensureSlideViewerSnapshot(slides[nIdx]);
    generatedAny = true;
  }
  if (generatedAny && this._viewerPrewarmToken === token && slides[this._viewerSlideIdx]) {
    this.deserializeFullSlideState(slides[this._viewerSlideIdx]);
    this._syncSmartViewerNeighborStages(this._viewerSlideIdx);
  }
}

_renderSmartViewerHotspots(slide, idx) {
  const hotspotsEl = document.getElementById('smartNoteViewerHotspots');
  if (!hotspotsEl) return;
  hotspotsEl.innerHTML = '';
  if (!slide) return;

  const hotspots = Array.isArray(slide.viewerGraphHotspots) ? slide.viewerGraphHotspots : [];
  hotspots.forEach((hs) => {
    if (!hs || !hs.graphSnapshot) return;
    const box = document.createElement('div');
    box.className = 'viewer-graph-hotspot';
    box.style.left = `${(hs.nx * 100).toFixed(2)}%`;
    box.style.top = `${(hs.ny * 100).toFixed(2)}%`;
    box.style.width = `${(hs.nw * 100).toFixed(2)}%`;
    box.style.height = `${(hs.nh * 100).toFixed(2)}%`;
    box.title = '';

    box.onclick = (e) => {
      e.stopPropagation();
      if (this._viewerSuppressHotspotClickUntil && performance.now() < this._viewerSuppressHotspotClickUntil) {
        return;
      }
      this.enterViewerGraphTouchMode(hs, idx);
    };
    hotspotsEl.appendChild(box);
  });

  const stickerHotspots = Array.isArray(slide.viewerStickerHotspots) ? slide.viewerStickerHotspots : [];
  stickerHotspots.forEach((sh) => {
    if (!sh) return;
    const sBox = document.createElement('div');
    sBox.className = 'viewer-sticker-hotspot' + (sh.revealed ? ' revealed' : '');
    sBox.style.left = `${(sh.nx * 100).toFixed(2)}%`;
    sBox.style.top = `${(sh.ny * 100).toFixed(2)}%`;
    sBox.style.width = `${(sh.nw * 100).toFixed(2)}%`;
    sBox.style.height = `${(sh.nh * 100).toFixed(2)}%`;
    const b = document.createElement('span');
    b.className = 'card-sticker-badge';
    b.textContent = sh.revealed ? '🔓' : '🔒 터치';
    sBox.appendChild(b);
    sBox.onclick = (e) => {
      e.stopPropagation();
      if (this._viewerSuppressHotspotClickUntil && performance.now() < this._viewerSuppressHotspotClickUntil) {
        return;
      }
      sh.revealed = !sh.revealed;
      sBox.classList.toggle('revealed', sh.revealed);
      b.textContent = sh.revealed ? '🔓' : '🔒 터치';
    };
    hotspotsEl.appendChild(sBox);
  });
}

_syncSmartViewerHeaderControls(idx, total, slide) {
  const btnWatchVideo = document.getElementById('btnViewerWatchVideo');
  const hasSlideAudio = Boolean(slide && slide.audioSyncData && slide.audioSyncData.durationMs > 0);
  if (btnWatchVideo) {
    btnWatchVideo.style.display = hasSlideAudio ? 'inline-flex' : 'none';
  }

  const navGroup = document.getElementById('viewerSlideNavGroup');
  const btnCounter = document.getElementById('btnViewerSlideCounter');
  const lblCounter = document.getElementById('lblViewerSlideCounter');
  const gridPopover = document.getElementById('viewerSlideGridPopover');
  const chipsBox = document.getElementById('viewerSlideChips');
  const btnPrev = document.getElementById('btnViewerPrevSlide');
  const btnNext = document.getElementById('btnViewerNextSlide');
  const btnEdgePrev = document.getElementById('btnViewerEdgePrev');
  const btnEdgeNext = document.getElementById('btnViewerEdgeNext');

  if (navGroup) navGroup.style.display = 'inline-flex';
  if (lblCounter) lblCounter.textContent = `${idx + 1} / ${total}`;
  if (btnCounter) {
    btnCounter.style.cursor = total > 1 ? 'pointer' : 'default';
    btnCounter.title = total > 1 ? '페이지 목록 열기' : '현재 페이지';
  }
  if (gridPopover) gridPopover.style.display = 'none';
  if (btnPrev) {
    btnPrev.style.display = total > 1 ? 'inline-flex' : 'none';
    btnPrev.disabled = (idx <= 0);
  }
  if (btnNext) {
    btnNext.style.display = total > 1 ? 'inline-flex' : 'none';
    btnNext.disabled = (idx >= total - 1);
  }
  if (btnEdgePrev) {
    btnEdgePrev.style.display = total > 1 ? 'inline-flex' : 'none';
    btnEdgePrev.disabled = (idx <= 0);
  }
  if (btnEdgeNext) {
    btnEdgeNext.style.display = total > 1 ? 'inline-flex' : 'none';
    btnEdgeNext.disabled = (idx >= total - 1);
  }
  if (chipsBox && this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides)) {
    if (chipsBox.children.length === total) {
      for (let i = 0; i < total; i++) {
        chipsBox.children[i].classList.toggle('active', i === idx);
      }
    } else {
      chipsBox.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'viewer-slide-chip' + (i === idx ? ' active' : '');
        const sTitle = this._viewerPkg.playlistSlides[i].slideTitle || '';
        chip.textContent = /^p\.\d+$/i.test(sTitle.trim()) ? sTitle.trim() : String(i + 1);
        chip.onclick = (e) => {
          e.stopPropagation();
          if (gridPopover) gridPopover.style.display = 'none';
          this.switchSmartViewerSlide(i);
        };
        chipsBox.appendChild(chip);
      }
    }
  }

  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (overlay && overlay.classList.contains('viewer-immersive-fullscreen') && total > 1) {
    this._flashViewerFloatingPageToast(idx, total);
  }
}

  async openSmartNoteViewer(pkg, forceNoteViewer = false) {
  if (!pkg || !Array.isArray(pkg.playlistSlides) || !pkg.playlistSlides.length) return;
  this._restoreDeduplicatedSlideSnapshots(pkg);
  this._commitPendingViewerCarouselImmediately();
  this.exitStudentAudioVideoOnlyMode();
  if (this.virtualStylusEl) {
    this.virtualStylusEl.style.display = 'none';
  }
  this._viewerPkg = pkg;
  this._mobileViewerFsAttempted = false;
  this.syncSmartViewerPromoBannerUI(pkg);
  const startIdx = Math.max(0, Math.min(pkg.playlistSlides.length - 1, pkg.currentIndex || 0));
  this._preloadSmartViewerSlides(pkg, startIdx);
  document.body.classList.remove('viewer-graph-touch-mode');
  const touchBar = document.getElementById('viewerGraphTouchBar');
  if (touchBar) touchBar.style.display = 'none';

  const overlay = document.getElementById('smartNoteViewerOverlay');
  const fsGate = document.getElementById('viewerFullscreenGate');
  const isAlreadyNativeFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  const isMobileOrTabletOS = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (overlay) {
    overlay.style.display = 'flex';
    if (!isMobileOrTabletOS || isAlreadyNativeFs || !fsGate) {
      overlay.classList.remove('viewer-entry-gate-active');
      overlay.classList.toggle('viewer-immersive-fullscreen', isAlreadyNativeFs);
      if (fsGate) fsGate.style.display = 'none';
    } else {
      overlay.classList.add('viewer-entry-gate-active');
      overlay.classList.remove('viewer-immersive-fullscreen');
      fsGate.style.display = 'flex';
    }
  }

  await this.switchSmartViewerSlide(startIdx);
}

  async switchSmartViewerSlide(idx, swipeDir = null, releaseVelocityX = 0) {
  this._commitPendingViewerCarouselImmediately();
  if (!this._viewerPkg || !this._viewerPkg.playlistSlides[idx]) return;
  const prevIdx = typeof this._viewerSlideIdx === 'number' ? this._viewerSlideIdx : idx;
  this._viewerSlideIdx = idx;
  const slide = this._viewerPkg.playlistSlides[idx];
  const total = this._viewerPkg.playlistSlides.length;

  // 슬라이드 스캔 이미지가 아직 없는 경우에만 비동기 생성 (이미 준비되어 있으면 0프레임 동기 즉시 출발!)
  if (!slide.viewerSnapshotDataUrl || slide.viewerSnapshotDataUrl === '__SAME_AS_PDF_BOARD__') {
    await this._ensureSlideViewerSnapshot(slide);
  }
  this._preloadSmartViewerSlides(this._viewerPkg, idx);

  const viewport = document.getElementById('smartNoteViewerViewport');
  const stage = document.getElementById('smartNoteViewerStage');
  const imgEl = document.getElementById('smartNoteViewerImg');

  // 🌟 [순정 PDF 뷰어급 3-패널 실시간 캐러셀 슬라이드 전환]:
  // 100% 배율에서 옆 페이지로 넘길 때 pointerup과 동일한 프레임에서 0ms 딜레이로 즉시 출발하며,
  // 남은 이동 거리와 손가락 속도에 맞춘 320~430ms iOS 감속 곡선(cubic-bezier(0.16, 1, 0.3, 1))으로 사뿐히 안착!
  const canCarouselGlide = Boolean(
    (swipeDir === 'next' || swipeDir === 'prev') &&
    (this._viewerZoom || 1.0) <= 1.02 &&
    stage &&
    imgEl &&
    imgEl.src &&
    prevIdx !== idx &&
    slide.viewerSnapshotDataUrl
  );

  if (canCarouselGlide) {
    const nStageId = swipeDir === 'next' ? 'smartNoteViewerNextStage' : 'smartNoteViewerPrevStage';
    const nImgId = swipeDir === 'next' ? 'smartNoteViewerNextImg' : 'smartNoteViewerPrevImg';
    const nStage = document.getElementById(nStageId);
    const nImg = document.getElementById(nImgId);
    const targetFit = this._calcSmartViewerFitSize(
      slide.viewerSnapshotWidth || (nImg && nImg.naturalWidth) || this._viewerBaseW || 1000,
      slide.viewerSnapshotHeight || (nImg && nImg.naturalHeight) || this._viewerBaseH || 700,
      viewport
    );

    if (nStage && nImg) {
      nStage.dataset.ready = '1';
      nStage.dataset.fitW = String(targetFit.displayW);
      if (nImg.src !== slide.viewerSnapshotDataUrl) {
        nImg.src = slide.viewerSnapshotDataUrl;
      }
      nImg.style.width = `${targetFit.displayW}px`;
      nImg.style.height = `${targetFit.displayH}px`;
    }

    // 화살표 버튼 클릭이나 키보드로 넘길 때(현재 panX === 0)는 시작 위치를 먼저 고정한 뒤 전체 폭 슬라이딩
    if (Math.abs(this._viewerPanX || 0) < 1) {
      this._setSmartViewerCarouselAnimating(false);
      this._viewerPanX = 0;
      this._viewerPanY = 0;
      this._applySmartViewerTransform();
      void stage.offsetWidth;
    }

    const stride = this._getSmartViewerSlideStride(viewport, targetFit.displayW);
    const alreadyMoved = Math.min(stride, Math.abs(this._viewerPanX || 0));
    const remainRatio = Math.max(0.22, 1 - (alreadyMoved / Math.max(1, stride)));
    const absVel = Math.min(2.4, Math.abs(releaseVelocityX || 0));
    const durationMs = Math.max(300, Math.min(430, Math.round((290 + 145 * remainRatio) - Math.min(65, absVel * 38))));

    this._setSmartViewerCarouselAnimating(true, durationMs);
    this._viewerPanX = swipeDir === 'next' ? -stride : stride;
    this._viewerPanY = 0;
    this._applySmartViewerTransform();
    this._syncSmartViewerHeaderControls(idx, total, slide);

    const commitCarousel = () => {
      this._setSmartViewerCarouselAnimating(false);
      if (imgEl && slide.viewerSnapshotDataUrl && imgEl.src !== slide.viewerSnapshotDataUrl) {
        imgEl.src = slide.viewerSnapshotDataUrl;
      }
      const finalFit = this._calcSmartViewerFitSize(
        slide.viewerSnapshotWidth || (imgEl && imgEl.naturalWidth) || targetFit.displayW,
        slide.viewerSnapshotHeight || (imgEl && imgEl.naturalHeight) || targetFit.displayH,
        viewport
      );
      this._viewerBaseW = finalFit.displayW;
      this._viewerBaseH = finalFit.displayH;
      this._viewerZoom = 1.0;
      this._viewerPanX = 0;
      this._viewerPanY = 0;
      this._renderSmartViewerHotspots(slide, idx);
      this._syncSmartViewerNeighborStages(idx);
      this._prewarmNeighborSlideSnapshots(idx);
    };

    this._viewerPendingCarouselCommit = commitCarousel;
    this._viewerCarouselTimer = setTimeout(() => {
      this._viewerCarouselTimer = null;
      if (this._viewerPendingCarouselCommit === commitCarousel) {
        this._viewerPendingCarouselCommit = null;
        commitCarousel();
      }
    }, durationMs + 10);
    return;
  }

  this._syncSmartViewerHeaderControls(idx, total, slide);

  if (imgEl && slide.viewerSnapshotDataUrl) {
    if (imgEl.src !== slide.viewerSnapshotDataUrl) {
      await new Promise((res) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          imgEl.onload = null;
          imgEl.onerror = null;
          res();
        };
        imgEl.onload = finish;
        imgEl.onerror = finish;
        imgEl.src = slide.viewerSnapshotDataUrl;
        if (imgEl.complete && imgEl.naturalWidth > 0) finish();
        setTimeout(finish, 180);
      });
    }
  }

  this._renderSmartViewerHotspots(slide, idx);
  this.fitSmartViewerStageToScreen(false, swipeDir);
  this._syncSmartViewerNeighborStages(idx);
  this._prewarmNeighborSlideSnapshots(idx);
}

fitSmartViewerStageToScreen(preserveZoomResetOnly = false, swipeDir = null) {
  this._commitPendingViewerCarouselImmediately();
  const viewport = document.getElementById('smartNoteViewerViewport');
  const stage = document.getElementById('smartNoteViewerStage');
  const imgEl = document.getElementById('smartNoteViewerImg');
  if (!viewport || !imgEl) return;

  const slide = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides))
    ? this._viewerPkg.playlistSlides[this._viewerSlideIdx || 0]
    : null;
  const iw = Math.max(1, (slide && slide.viewerSnapshotWidth) || imgEl.naturalWidth || 1000);
  const ih = Math.max(1, (slide && slide.viewerSnapshotHeight) || imgEl.naturalHeight || 700);
  const { displayW, displayH } = this._calcSmartViewerFitSize(iw, ih, viewport);

  this._viewerBaseW = displayW;
  this._viewerBaseH = displayH;
  this._viewerZoom = 1.0;
  this._viewerPanY = 0;

  if (stage && (swipeDir === 'next' || swipeDir === 'prev')) {
    this._setSmartViewerCarouselAnimating(false);
    this._viewerPanX = swipeDir === 'next' ? 56 : -56;
    this._applySmartViewerTransform();
    void stage.offsetWidth;
    this._setSmartViewerCarouselAnimating(true, 360);
    this._viewerPanX = 0;
    this._applySmartViewerTransform();
  } else {
    if (preserveZoomResetOnly) {
      this._setSmartViewerCarouselAnimating(true, 320);
    } else {
      this._setSmartViewerCarouselAnimating(false);
    }
    this._viewerPanX = 0;
    this._syncSmartViewerNeighborStages(this._viewerSlideIdx || 0);
  }
}

_clampSmartViewerPan() {
  const viewport = document.getElementById('smartNoteViewerViewport');
  if (!viewport) return;
  const zoom = this._viewerZoom || 1.0;
  if (zoom <= 1.01) {
    this._viewerPanX = 0;
    this._viewerPanY = 0;
    return;
  }
  const vw = Math.max(180, viewport.clientWidth);
  const vh = Math.max(160, viewport.clientHeight);
  const zoomedW = (this._viewerBaseW || 1000) * zoom;
  const zoomedH = (this._viewerBaseH || 700) * zoom;

  const maxPanX = Math.max(0, (zoomedW - vw) / 2);
  const maxPanY = Math.max(0, (zoomedH - vh) / 2);
  this._viewerPanX = Math.max(-maxPanX, Math.min(maxPanX, this._viewerPanX || 0));
  this._viewerPanY = Math.max(-maxPanY, Math.min(maxPanY, this._viewerPanY || 0));
}

setSmartViewerZoom(nextZoom, focalClientX = null, focalClientY = null) {
  this._commitPendingViewerCarouselImmediately();
  const viewport = document.getElementById('smartNoteViewerViewport');
  const prevZoom = this._viewerZoom || 1.0;
  const clampedZoom = Math.max(1.0, Math.min(3.0, nextZoom));

  if (Math.abs(clampedZoom - 1.0) < 0.02) {
    this._viewerZoom = 1.0;
    this._viewerPanX = 0;
    this._viewerPanY = 0;
    this._applySmartViewerTransform();
    return;
  }

  if (viewport && Number.isFinite(focalClientX) && Number.isFinite(focalClientY)) {
    const rect = viewport.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const ratio = clampedZoom / Math.max(0.1, prevZoom);
    this._viewerPanX = (focalClientX - cx) - ((focalClientX - cx - (this._viewerPanX || 0)) * ratio);
    this._viewerPanY = (focalClientY - cy) - ((focalClientY - cy - (this._viewerPanY || 0)) * ratio);
  }

  this._viewerZoom = clampedZoom;
  this._clampSmartViewerPan();
  this._applySmartViewerTransform();
}

_applySmartViewerTransform() {
  const viewport = document.getElementById('smartNoteViewerViewport');
  const stage = document.getElementById('smartNoteViewerStage');
  const prevStage = document.getElementById('smartNoteViewerPrevStage');
  const nextStage = document.getElementById('smartNoteViewerNextStage');
  const imgEl = document.getElementById('smartNoteViewerImg');
  const lblZoom = document.getElementById('lblViewerZoom');
  const zoom = this._viewerZoom || 1.0;
  const baseW = this._viewerBaseW || 1000;
  const baseH = this._viewerBaseH || 700;
  const zoomedW = Math.max(2, Math.round((baseW * zoom) / 2) * 2);
  const zoomedH = Math.max(2, Math.round((baseH * zoom) / 2) * 2);

  if (imgEl) {
    imgEl.style.width = `${zoomedW}px`;
    imgEl.style.height = `${zoomedH}px`;
  }
  const px = Math.round(this._viewerPanX || 0);
  const py = Math.round(this._viewerPanY || 0);
  if (stage) {
    stage.style.transform = `translate3d(calc(-50% + ${px}px), calc(-50% + ${py}px), 0)`;
  }

  const showNeighbors = (zoom <= 1.02);
  if (prevStage) {
    if (showNeighbors && prevStage.dataset.ready === '1') {
      const prevW = Number(prevStage.dataset.fitW) || baseW;
      const prevStride = this._getSmartViewerSlideStride(viewport, prevW);
      prevStage.style.display = 'inline-block';
      prevStage.style.transform = `translate3d(calc(-50% + ${px - prevStride}px), calc(-50% + ${py}px), 0)`;
    } else {
      prevStage.style.display = 'none';
    }
  }
  if (nextStage) {
    if (showNeighbors && nextStage.dataset.ready === '1') {
      const nextW = Number(nextStage.dataset.fitW) || baseW;
      const nextStride = this._getSmartViewerSlideStride(viewport, nextW);
      nextStage.style.display = 'inline-block';
      nextStage.style.transform = `translate3d(calc(-50% + ${px + nextStride}px), calc(-50% + ${py}px), 0)`;
    } else {
      nextStage.style.display = 'none';
    }
  }

  if (lblZoom) {
    lblZoom.textContent = `${Math.round(zoom * 100)}%`;
  }
}

_resolveFallbackViewerHotspotGraphInk(hotspot, slideIdx = 0) {
  if (!hotspot || !hotspot.graphSnapshot) return [];
  let parsedSnap = null;
  try {
    parsedSnap = typeof hotspot.graphSnapshot === 'string' ? JSON.parse(hotspot.graphSnapshot) : hotspot.graphSnapshot;
  } catch (_) {
    parsedSnap = null;
  }
  const hsId = String(hotspot.id || '');
  const hsCase = Number(hotspot.caseIdx) || 1;

  // 1. 슬라이드 데이터(뷰어 패키지 / 수업 플레이리스트) 내부의 카드 필기 확인
  const slideList = (this._viewerPkg && Array.isArray(this._viewerPkg.playlistSlides) && this._viewerPkg.playlistSlides.length > 0)
    ? this._viewerPkg.playlistSlides
    : (Array.isArray(this.lessonPlaylistSlides) ? this.lessonPlaylistSlides : []);
  const slideData = slideList[slideIdx] || null;
  if (slideData) {
    if ((hsId === 'graph_card_1' || hsCase === 1) && slideData.primaryGraphCard && Array.isArray(slideData.primaryGraphCard.graphInkStrokes) && slideData.primaryGraphCard.graphInkStrokes.length > 0) {
      const parsedW = parseFloat(slideData.primaryGraphCard.width) || slideData.primaryGraphCard.cardW || 430;
      const effAspect = slideData.primaryGraphCard.graphCardAspect || slideData.primaryGraphCard.aspect || 0.82;
      const cw = (parsedSnap && parsedSnap._pipCardW) || parsedW;
      const ch = (parsedSnap && parsedSnap._pipCardH) || Math.round(cw * effAspect);
      return this._convertCardStrokeListToFullGraphInkStrokes(
        JSON.parse(JSON.stringify(slideData.primaryGraphCard.graphInkStrokes)),
        parsedSnap,
        cw,
        ch
      );
    }
    if (Array.isArray(slideData.extraGraphs) && slideData.extraGraphs.length > 0) {
      const eg = slideData.extraGraphs.find((item, idx) => (Number(item && item.caseIdx) || (idx + 2)) === hsCase);
      const egStrokes = eg
        ? ((Array.isArray(eg.cardInkStrokes) && eg.cardInkStrokes.length > 0) ? eg.cardInkStrokes : eg.graphInkStrokes)
        : null;
      if (eg && Array.isArray(egStrokes) && egStrokes.length > 0) {
        const parsedW = parseFloat(eg.width) || eg.cardW || 430;
        const effAspect = eg.aspect || eg.graphCardAspect || 0.82;
        const cw = (parsedSnap && parsedSnap._pipCardW) || parsedW;
        const ch = (parsedSnap && parsedSnap._pipCardH) || Math.round(cw * effAspect);
        return this._convertCardStrokeListToFullGraphInkStrokes(
          JSON.parse(JSON.stringify(egStrokes)),
          parsedSnap,
          cw,
          ch
        );
      }
    }
  }

  // 2. 현재 라이브 워크스페이스의 창모드 카드 필기 확인
  if (hsId === 'graph_card_1' || hsCase === 1) {
    const gWidget = document.getElementById('graphCardWidget');
    if (gWidget && gWidget.style.display !== 'none' && Array.isArray(this.graphInkStrokes) && this.graphInkStrokes.length > 0) {
      return this._buildFullGraphInkStrokesFromPipCard('primary');
    }
  } else if (Array.isArray(this.extraGraphCards) && this.extraGraphCards.length > 0) {
    const foundCard = this.extraGraphCards.find((c, idx) => c && (Number(c.caseIdx) || (idx + 2)) === hsCase);
    if (foundCard && foundCard.el && Array.isArray(foundCard.el._cardInkStrokes) && foundCard.el._cardInkStrokes.length > 0) {
      return this._buildFullGraphInkStrokesFromPipCard(foundCard);
    }
  }

  return [];
}

enterViewerGraphTouchMode(hotspot, slideIdx = 0) {
  if (!hotspot || !hotspot.graphSnapshot) return;
  try {
    const parsed = typeof hotspot.graphSnapshot === 'string' ? JSON.parse(hotspot.graphSnapshot) : hotspot.graphSnapshot;
    if (parsed && parsed.isNAxisStudioCard && parsed.nAxisStudioState) {
      if (typeof this.openNAxisStudioModal === 'function') {
        this.openNAxisStudioModal(parsed.nAxisStudioState);
      }
      return;
    }
  } catch (_) { }
  this._activeViewerHotspot = hotspot;
  this._viewerSlideIdx = slideIdx;

  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (overlay) overlay.style.display = 'none';

  this._isAudioSyncPlayerVisible = false;
  if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
  if (this.virtualStylusEl) {
    this.virtualStylusEl.style.display = 'none';
  }
  document.body.classList.add('viewer-graph-touch-mode');
  if (this.pdfPageBoardData) {
    this._viewerTouchSavedPdfBoardData = this.pdfPageBoardData;
    this.pdfPageBoardData = null;
  }
  this._viewerTouchSavedGraphInkStrokes = Array.isArray(this.inkStrokes)
    ? JSON.parse(JSON.stringify(this.inkStrokes.filter(s => s && s.target === 'graph')))
    : [];
  this.isGraphCovered = false;
  this.isInkMode = false;
  if (typeof this.syncInkUiVisibility === 'function') {
    this.syncInkUiVisibility();
  }
  document.body.classList.remove('ink-mode-active');
  this.updateInkCursor();

  this.applyPureGraphSnapshot(hotspot.graphSnapshot);
  const hasLoadedGraphInk = Array.isArray(this.inkStrokes) && this.inkStrokes.some(s => s && s.target === 'graph');
  if (!hasLoadedGraphInk) {
    const fallbackStrokes = this._resolveFallbackViewerHotspotGraphInk(hotspot, slideIdx);
    if (Array.isArray(fallbackStrokes) && fallbackStrokes.length > 0) {
      if (!Array.isArray(this.inkStrokes)) this.inkStrokes = [];
      this.inkStrokes.push(...fallbackStrokes);
    }
  }
  this.showAxes = true;
  this.showGuides = false;
  this.activeGraphIdx = (this.graphs && this.graphs.length > 0) ? 0 : -1;
  this.isCurveSelected = (this.activeGraphIdx >= 0);
  this.selectedHandleIdx = null;

  this.resizeCanvas();
  this.autoCenterGraphForTouchViewer(hotspot.graphSnapshot);
  this._inkBakeDirty = true;
  if (typeof this.clearInkCache === 'function') this.clearInkCache();

  const touchBar = document.getElementById('viewerGraphTouchBar');
  const lblTitle = document.getElementById('lblViewerGraphTouchTitle');
  if (lblTitle) {
    lblTitle.textContent = '그래프';
  }
  this._renderViewerGraphCurveChips();
  if (touchBar) touchBar.style.display = 'flex';

  this.updateIntersections();
  this.render();
}

_renderViewerGraphCurveChips() {
  const box = document.getElementById('viewerGraphCurveChips');
  const touchBar = document.getElementById('viewerGraphTouchBar');
  const leftGroup = touchBar ? touchBar.querySelector('.viewer-graph-touch-left') : null;
  if (!box) return;
  box.innerHTML = '';
  const hasMulti = Boolean(this.graphs && this.graphs.length > 1);
  if (leftGroup) {
    leftGroup.style.display = hasMulti ? 'inline-flex' : 'none';
  }
  if (!hasMulti) return;
  this.graphs.forEach((g, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'viewer-curve-chip' + (idx === this.activeGraphIdx ? ' active' : '');
    btn.textContent = `f${idx + 1}`;
    btn.style.borderColor = g.color || '#60a5fa';
    btn.onclick = () => {
      this.activeGraphIdx = idx;
      this.isCurveSelected = true;
      this.selectedHandleIdx = null;
      this._renderViewerGraphCurveChips();
      this.render();
    };
    box.appendChild(btn);
  });
}

autoCenterGraphForTouchViewer(rawSnapshot = null) {
  if (!this.graphs || this.graphs.length === 0) return;

  let parsedSnap = null;
  const srcSnap = rawSnapshot || (this._activeViewerHotspot && this._activeViewerHotspot.graphSnapshot) || null;
  if (srcSnap) {
    try {
      parsedSnap = typeof srcSnap === 'string' ? JSON.parse(srcSnap) : srcSnap;
    } catch (_) {
      parsedSnap = null;
    }
  }

  const isPipHotspot = Boolean(
    (parsedSnap && parsedSnap._isPipCardSnapshot) ||
    (this._activeViewerHotspot && String(this._activeViewerHotspot.id || '').startsWith('graph_card_'))
  );

  // 1. 창모드(PiP 그래프 카드) 핫스팟: 원점이나 핸들 평균이 아니라, 창모드에서 보고 있던 센터 좌표(centerMathX, centerMathY)에 100% 초점 동기화!
  if (parsedSnap && isPipHotspot) {
    const isTrig = Array.isArray(this.graphs) && this.graphs.some(g => g && ["sin_1period", "cos_1period", "tan_1period"].includes(g.type));
    const cardH = Math.max(60, parsedSnap._pipCardH || 353);
    const cardYSpan = (typeof parsedSnap.ySpan === 'number' && parsedSnap.ySpan > 0) ? parsedSnap.ySpan : (isTrig ? 5.0 : 5.1);
    const cardZoom = (typeof parsedSnap.zoomLevel === 'number' && parsedSnap.zoomLevel > 0) ? parsedSnap.zoomLevel : 1.0;
    const cardUnitScale = (cardH / 2) / Math.max(0.1, cardYSpan / cardZoom);
    const centerMathX = -(parsedSnap.panX || 0) / Math.max(1e-6, cardUnitScale);
    const centerMathY = (parsedSnap.panY || 0) / Math.max(1e-6, cardUnitScale);

    const baseCardYSpan = isTrig ? 5.0 : 5.1;
    const baseFullYSpan = isTrig ? 5.5 : 6.0;
    const spanScale = cardYSpan / baseCardYSpan;
    this.xSpan = isTrig ? 20.0 : 8.5;
    this.ySpan = Math.max(2.0, Math.min(18.0, (baseFullYSpan * spanScale) / Math.max(0.25, cardZoom)));
    this.zoomLevel = 1.0;
    this.targetZoom = 1.0;

    const sw = Math.max(300, this.screenWidth || window.innerWidth || 1440);
    const sh = Math.max(300, this.screenHeight || window.innerHeight || 900);
    const fullUnitScale = (sh / 2) / (this.ySpan / this.zoomLevel);
    this.panX = Math.round(-centerMathX * fullUnitScale);
    this.panY = Math.round(centerMathY * fullUnitScale);
    return;
  }

  // 2. 전체화면 그래프 모드 스냅샷(graph_live_1): 문제 카드 오프셋을 제거하고 보고 있던 시야 중심을 화면 정중앙에 배치
  if (parsedSnap && typeof parsedSnap.panX === 'number' && typeof parsedSnap.ySpan === 'number') {
    const sh = Math.max(300, this.screenHeight || window.innerHeight || 900);
    const snapYSpan = parsedSnap.ySpan || 6.0;
    const snapZoom = parsedSnap.zoomLevel || 1.0;
    const snapUnitScale = (sh / 2) / Math.max(0.1, snapYSpan / snapZoom);
    const pushOffsetX = (typeof this._lastFullGraphProblemPushX === 'number') ? this._lastFullGraphProblemPushX : 0;
    const effPanX = (parsedSnap.panX || 0) - pushOffsetX;
    const centerMathX = -effPanX / Math.max(1e-6, snapUnitScale);
    const centerMathY = (parsedSnap.panY || 0) / Math.max(1e-6, snapUnitScale);

    this.xSpan = parsedSnap.xSpan || 8.5;
    this.ySpan = snapYSpan;
    this.zoomLevel = snapZoom;
    this.targetZoom = snapZoom;
    const fullUnitScale = (sh / 2) / Math.max(0.1, this.ySpan / this.zoomLevel);
    this.panX = Math.round(-centerMathX * fullUnitScale);
    this.panY = Math.round(centerMathY * fullUnitScale);
    return;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const expandPt = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  expandPt(0, 0);
  this.graphs.forEach(g => {
    if (g && Array.isArray(g.handles)) {
      g.handles.forEach(h => {
        const wPos = this.engine.getHandleWorldPos(g, h);
        if (wPos) expandPt(wPos.x, wPos.y);
      });
    }
  });
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const spanX = Math.max(4.5, (maxX - minX) * 1.65);
  const spanY = Math.max(4.5, (maxY - minY) * 1.65);

  const sw = Math.max(300, this.screenWidth || window.innerWidth);
  const sh = Math.max(300, this.screenHeight || window.innerHeight);
  const aspect = sw / sh;
  const neededYSpan = Math.max(spanY / 2, (spanX / 2) / Math.max(0.45, aspect));
  this.ySpan = Math.max(3.2, Math.min(14.0, neededYSpan));
  this.zoomLevel = 1.0;

  const unitPx = (sh / 2) / this.ySpan;
  this.panX = -midX * unitPx;
  this.panY = midY * unitPx;
}

exitViewerGraphTouchModeToViewer() {
  document.body.classList.remove('viewer-graph-touch-mode');
  if (this._viewerTouchSavedPdfBoardData && !this.pdfPageBoardData) {
    this.pdfPageBoardData = this._viewerTouchSavedPdfBoardData;
  }
  this._viewerTouchSavedPdfBoardData = null;
  if (Array.isArray(this._viewerTouchSavedGraphInkStrokes)) {
    if (!Array.isArray(this.inkStrokes)) this.inkStrokes = [];
    this.inkStrokes = this.inkStrokes.filter(s => s && s.target !== 'graph');
    this.inkStrokes.push(...this._viewerTouchSavedGraphInkStrokes);
    this._viewerTouchSavedGraphInkStrokes = null;
    this._inkBakeDirty = true;
    if (typeof this.clearInkCache === 'function') this.clearInkCache();
  }
  const touchBar = document.getElementById('viewerGraphTouchBar');
  if (touchBar) touchBar.style.display = 'none';

  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (overlay) overlay.style.display = 'flex';
}

  async exitSmartNoteViewerToEditMode() {
  if (this._viewerPkg && typeof this._ensureCloudShareAudioLoaded === 'function') {
    const btnEdit = document.getElementById('btnViewerEnterEdit');
    const prevTxt = btnEdit ? btnEdit.innerHTML : '';
    if (btnEdit && this._viewerPkg._hasLazyAudio) {
      btnEdit.disabled = true;
      btnEdit.innerHTML = '<span>⏳ 준비 중...</span>';
    }
    try {
      await this._ensureCloudShareAudioLoaded(this._viewerPkg);
    } finally {
      if (btnEdit && prevTxt) {
        btnEdit.disabled = false;
        btnEdit.innerHTML = prevTxt;
      }
    }
  }
  this._clearSmartViewerPreloadedImages();
  const overlay = document.getElementById('smartNoteViewerOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.classList.remove('viewer-immersive-fullscreen');
  }
  document.body.classList.remove('viewer-graph-touch-mode');
  document.body.classList.remove('student-mode');
  this._isAudioSyncPlayerVisible = false;
  if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
  const touchBar = document.getElementById('viewerGraphTouchBar');
  if (touchBar) touchBar.style.display = 'none';

  if (this._viewerPkg) {
    this._viewerPkg.currentIndex = this._viewerSlideIdx || 0;
    this.applyCloudSharePackage(this._viewerPkg);
  }

  const resetBar = document.getElementById('sharedResetBar');
  if (resetBar) {
    resetBar.style.display = 'none';
  }
  this.resizeCanvas();
  this.render();
}

applyCloudSharePackage(pkg) {
  if (!pkg || !Array.isArray(pkg.playlistSlides) || !pkg.playlistSlides.length) return;
  if (pkg.playlistSlides.length > 1 || pkg.isPlaylist) {
    this.startLessonPlaylist(pkg.playlistSlides, pkg.currentIndex || 0);
  } else {
    this.isLessonPlaylistActive = false;
    this.syncLessonPlaylistNavBarUI();
    this.deserializeFullSlideState(pkg.playlistSlides[0]);
  }
}

// 역직렬화된 데이터를 캔버스에 완벽 복원
applyState(data) {
  if (!data || !data.g) return;
  if (this.isGraphCovered) {
    this.enterGraphModeFromBoard();
  }

  // 1. 그래프 레이어 복원
  const baseStamp = Date.now();
  this.graphs = data.g.map((gItem, idx) => {
    const g = {
      id: `g_${baseStamp}_${idx}`,
      type: gItem.t,
      category: (this.meta[gItem.t] && this.meta[gItem.t].category) || '📐 다항함수',
      color: gItem.c || this.colorPalette[idx % this.colorPalette.length],
      lineWidth: gItem.w || 2.8,
      isAbsolute: gItem.a === 1,
      shapeMode: gItem.qm || 'free',
      originCenter: Boolean(gItem.qo),
      isTransposedYX: gItem.tyx === 1,
      linkedInverseId: null,
      handles: []
    };

    if (gItem.qm) g.quadMode = gItem.qm;
    if (gItem.qo) g.quadOriginCenter = true;
    g.isFrozen = gItem.fz === 1;
    g.freezeOffset = (gItem.fzo && Array.isArray(gItem.fzo)) ? { x: gItem.fzo[0], y: gItem.fzo[1] } : { x: 0, y: 0 };
    g.frozenInvertH = gItem.fzh === 1;
    g.frozenInvertV = gItem.fzv === 1;
    g.frozenAbsolute = gItem.fza === 1;
    if (gItem.ind === 1 || g.isTransposedYX) g.isIndependent = true;
    if (Array.isArray(gItem.tr) && gItem.tr.length > 0) {
      g.transforms = gItem.tr.map(tItem => ({
        offset: (tItem && Array.isArray(tItem.o))
          ? { x: Number(tItem.o[0]) || 0, y: Number(tItem.o[1]) || 0 }
          : { x: Number(tItem && tItem.ox) || 0, y: Number(tItem && tItem.oy) || 0 },
        invertH: Boolean(tItem && tItem.ih === 1),
        invertV: Boolean(tItem && tItem.iv === 1),
        abs: Boolean(tItem && tItem.ab === 1)
      }));
    }

    if (gItem.h && Array.isArray(gItem.h)) {
      g.handles = gItem.h.map((pt, hIdx) => {
        const hObj = {
          x: pt[0],
          y: pt[1]
        };
        const metaHandles = (this.meta[gItem.t] && this.meta[gItem.t].handles) || [];
        if (metaHandles[hIdx]) {
          hObj.name = metaHandles[hIdx].name;
          hObj.type = metaHandles[hIdx].type;
        } else {
          hObj.name = `핸들 ${hIdx + 1}`;
          hObj.type = 'point';
        }

        if (gItem.t === 'general_expr') {
          const raw = pt[2] || 'x^2';
          hObj.rawExpr = raw;
          hObj.reflectX = pt[3] === 1;
          hObj.reflectY = pt[4] === 1;
          const comp = (typeof SafeMathCompiler !== 'undefined' && SafeMathCompiler)
            ? SafeMathCompiler.compile(raw)
            : (typeof window !== 'undefined' && window.SafeMathCompiler ? window.SafeMathCompiler.compile(raw) : null);
          if (comp && comp.success) {
            hObj.fn = comp.fn;
          }
        }
        return hObj;
      });

      // #share= 역직렬화 시 뒤집힌 다항함수의 극대/극소 핸들 성격·라벨 정밀 복원 (구버전 3핸들 4th_skew 2핸들 하위호환 포함)
      if ((g.type === '4th_skew' || g.type === '4th_basic_bowl') && g.handles.length >= 2) {
        if (g.type === '4th_skew' && g.handles.length > 2) {
          g.handles = g.handles.slice(0, 2);
        }
        const isUp = g.handles[1].y >= g.handles[0].y;
        g.handles[0].type = isUp ? 'min' : 'max';
        g.handles[0].name = isUp ? '극소' : '극대';
      } else if (g.type === '4th_inflection' && g.handles.length >= 2) {
        const isMin = g.handles[1].y <= g.handles[0].y;
        g.handles[1].type = isMin ? 'min' : 'max';
        g.handles[1].name = isMin ? '극소' : '극대';
      }
    }

    return g;
  });

  // 역함수 연동 쌍(linkedInverseId) 복원
  data.g.forEach((gItem, idx) => {
    if (gItem && typeof gItem.li === 'number' && gItem.li >= 0 && gItem.li < this.graphs.length && gItem.li !== idx) {
      this.graphs[idx].linkedInverseId = this.graphs[gItem.li].id;
    }
  });

  this.activeGraphIdx = this.graphs.length > 0 ? 0 : -1;
  this.isCurveSelected = false;
  this.selectedHandleIdx = null;

  // 2. 옵션 복원
  const o = data.o || {};
  if (o.th && this.canvasThemes[o.th]) {
    this.currentThemeKey = o.th;
    document.querySelectorAll('.theme-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.theme === o.th);
    });
  }

  if (o.ax !== undefined) this.showAxes = o.ax === 1;
  if (o.ar !== undefined) this.showArrows = o.ar === 1;
  if (o.as !== undefined) this.showAsymptotes = o.as === 1;
  if (o.gd !== undefined) this.showGuides = o.gd === 1;
  if (o.ig !== undefined) {
    this.showInverseGuide = o.ig === 1;
    const chkInv = document.getElementById('chkInverseGuide');
    if (chkInv) chkInv.checked = this.showInverseGuide;
  }
  if (o.zm !== undefined) this.zoomLevel = o.zm;
  if (typeof o.px === 'number') this.panX = o.px;
  if (typeof o.py === 'number') this.panY = o.py;
  if (o.int !== undefined) this.useIntersectionDetector = o.int === 1;
  if (Array.isArray(o.dl)) this.dropLines = JSON.parse(JSON.stringify(o.dl));
  if (Array.isArray(o.tl)) this.textLabels = JSON.parse(JSON.stringify(o.tl));

  // 구간 분할 복원
  if (o.pw === 1) {
    this.usePiecewise = true;
    if (o.pwbs && Array.isArray(o.pwbs)) {
      this.piecewiseBoundaries = [...o.pwbs];
      this.piecewiseFuncMap = o.pwm ? [...o.pwm] : [];
      this.pwK = this.piecewiseBoundaries[0] || 0.0;
    } else if (o.pwb !== undefined) {
      this.piecewiseBoundaries = [Number(o.pwb)];
      this.piecewiseFuncMap = [0, 1];
      this.pwK = Number(o.pwb);
    }
    if (Array.isArray(o.pwi)) this.piecewiseInclusions = [...o.pwi];
    this.isPiecewisePeriodic = o.pwp === 1;
    if (typeof o.pws === 'number') this.periodicStepY = o.pws;
    this.isPiecewiseLocked = o.pwl === 1;
    if (o.pwg !== undefined) this.showPiecewiseGhost = o.pwg === 1;
    const btnQuick = document.getElementById('btnQuickPiecewise');
    if (btnQuick) btnQuick.classList.add('active');
    const chk = document.getElementById('chkPiecewise');
    if (chk) chk.checked = true;
  } else {
    this.usePiecewise = false;
    this.isPiecewiseLocked = false;
    this.isPiecewisePeriodic = false;
    this.piecewiseBoundaries = [];
    this.piecewiseFuncMap = [];
    const btnQuick = document.getElementById('btnQuickPiecewise');
    if (btnQuick) btnQuick.classList.remove('active');
    const chk = document.getElementById('chkPiecewise');
    if (chk) chk.checked = false;
  }

  // 캡처영역 복원
  if (o.vf === 1) {
    this.useViewfinder = true;
    if (o.vfa) this.vfAspectName = o.vfa;
    if (o.vfw) this.vfScreenW = o.vfw;
    if (typeof o.vfti === 'number' && o.vfti > 0) this.vfTargetWIn = o.vfti;
  } else {
    this.useViewfinder = false;
  }

  // 3. UI 동기화 및 렌더링
  this.syncControls();
  this.renderLayerList();
  this.renderFuncList();
  this.resizeCanvas();
  this.render();
}

updateCanvasRect() {
  if (this.canvas) {
    this.canvasRect = this.canvas.getBoundingClientRect();
  }
  return this.canvasRect;
}

_canEncodeCanvasWebP() {
  if (typeof this._cachedCanEncodeWebP === 'boolean') {
    return this._cachedCanEncodeWebP;
  }
  if (typeof document === 'undefined') {
    return false;
  }
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const url = probe.toDataURL('image/webp', 0.8);
    this._cachedCanEncodeWebP = Boolean(url && url.startsWith('data:image/webp'));
  } catch (e) {
    this._cachedCanEncodeWebP = false;
  }
  return this._cachedCanEncodeWebP;
}

encodeCanvasSmartWebP(canvas, quality = 1.0, allowJpegFallback = true) {
  if (!canvas) return '';
  if (typeof quality === 'number' && quality < 0.99) {
    if (this._canEncodeCanvasWebP()) {
      try {
        const webp = canvas.toDataURL('image/webp', quality);
        if (webp && webp.startsWith('data:image/webp')) return webp;
      } catch (e) { }
    }
    if (allowJpegFallback !== false) {
      try {
        const jpegQuality = Math.min(0.92, Math.max(0.82, quality + 0.06));
        const jpeg = canvas.toDataURL('image/jpeg', jpegQuality);
        if (jpeg && jpeg.startsWith('data:image/jpeg')) return jpeg;
      } catch (e) { }
    }
  }
  return canvas.toDataURL('image/png');
}

getCanvasDpr() {
  return Math.min(2.5, Math.max(2.0, window.devicePixelRatio || 2.0));
}

_syncIosTopStatusGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return;
  const isIOS = this.isIOSOrIPad();
  if (!isIOS) {
    document.body.classList.remove('ios-top-guard-active');
    return;
  }
  const isStandalone = Boolean(
    window.navigator.standalone === true ||
    (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches))
  );
  const scrMin = Math.min(window.screen.width || 0, window.screen.height || 0);
  const scrMax = Math.max(window.screen.width || 0, window.screen.height || 0);
  const winH = window.innerHeight || 0;
  const isFullTopViewport = (scrMin > 0 && Math.abs(winH - scrMin) < 48) || (scrMax > 0 && Math.abs(winH - scrMax) < 48);
  const shouldGuard = isStandalone || isFullTopViewport;
  const prevGuard = document.body.classList.contains('ios-top-guard-active');
  document.body.classList.toggle('ios-top-guard-active', shouldGuard);
  const curTheme = (this.canvasThemes && this.canvasThemes[this.currentThemeKey]) || null;
  if (curTheme && curTheme.bg) {
    if (document.documentElement) {
      document.documentElement.style.setProperty('--app-root-bg', curTheme.bg);
      document.documentElement.style.backgroundColor = curTheme.bg;
    }
    document.body.style.setProperty('--app-root-bg', curTheme.bg);
    document.body.style.backgroundColor = curTheme.bg;
  }
  if (prevGuard !== shouldGuard && this.canvas) {
    this.updateCanvasRect();
  }
}

resizeCanvas() {
  this._syncIosTopStatusGuard();
  const prevW = this.screenWidth;
  const prevH = this.screenHeight;
  let targetCssW = 0;
  let targetCssH = 0;
  if (typeof this._isFixedReplayStageActive === 'function' && this._isFixedReplayStageActive()) {
    const stageSz = this._getActiveAudioReplayStageSize();
    targetCssW = stageSz.w;
    targetCssH = stageSz.h;
  } else {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    targetCssW = Math.round(rect.width || window.innerWidth || 1280);
    targetCssH = Math.round(rect.height || window.innerHeight || 720);
  }
  const dpr = this.getCanvasDpr();
  this.canvas.width = Math.round(targetCssW * dpr);
  this.canvas.height = Math.round(targetCssH * dpr);
  this.canvas.style.width = `${targetCssW}px`;
  this.canvas.style.height = `${targetCssH}px`;
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.ctx.imageSmoothingEnabled = true;
  this.ctx.imageSmoothingQuality = 'high';
  this.screenWidth = targetCssW;
  this.screenHeight = targetCssH;
  this.updateCanvasRect();

  // 🌟 [오프스크린 잉크 베이크 버퍼 크기(Overscan 포함) 및 dpr 스케일 동기화]
  if (this.inkBakeCanvas && this.inkGraphBakeCanvas) {
    const { padX, padY, width: bakeW, height: bakeH } = this._getInkBakeMetrics();
    this.inkBakeCanvas.width = bakeW;
    this.inkBakeCanvas.height = bakeH;
    this.inkBakeCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);

    this.inkGraphBakeCanvas.width = bakeW;
    this.inkGraphBakeCanvas.height = bakeH;
    this.inkGraphBakeCtx.setTransform(dpr, 0, 0, dpr, padX * dpr, padY * dpr);

    this._inkBakeDirty = true;
  }
  if (this.sceneFreezeCanvas && this.sceneFreezeCtx) {
    this.sceneFreezeCanvas.width = this.canvas.width;
    this.sceneFreezeCanvas.height = this.canvas.height;
    this.sceneFreezeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._hasSceneFreeze = false;
  }

  // [대표님 기획: 처음 켜거나 창 크기 변경 시 시원하고 넉넉한 황금 여백으로 자동 설정!]
  if (!this.hasInitializedVf || this.vfScreenW > this.screenWidth - 40) {
    this.vfScreenW = this.calcIdealVfWidth(this.vfAspect);
    this.hasInitializedVf = true;
    const sl = document.getElementById('sliderVfWidth');
    if (sl) sl.value = this.vfScreenW;
    const lbl = document.getElementById('lblVfWidth');
    if (lbl) lbl.textContent = `${this.vfScreenW} px`;
  }
}

calcIdealVfWidth(aspect = this.vfAspect) {
  // 캔버스 화면 크기에 맞춰 시원하게 작업할 수 있는 황금 여백(가로 68%, 세로 72%) 자동 계산!
  const maxW = Math.max(320, this.screenWidth * 0.68);
  const maxH = Math.max(260, this.screenHeight * 0.72);
  let targetW = maxH * aspect;
  if (targetW > maxW) {
    targetW = maxW;
  }
  return Math.round(targetW);
}
  }.prototype);
delete _desc.constructor;
Object.defineProperties(GraphApp.prototype, _desc);
}
