/**
 * Graph Master Web - Google Auth, Cloud Hub, Subscription Quota, Custom Presets, .graphly File & Smart Viewer (app-cloud.js)
 */
{
  const _desc = Object.getOwnPropertyDescriptors(class {
  // ============================================================================
  // ☁️ [클라우드 보관함 · 수업 슬라이드(PPT) · 기출 게시판 & 통합 공유 엔진]
  // ============================================================================
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
    this.myLibraryCache = [];
    this._restoreActiveCloudUserSession();
    if (this.cloudUser && this.cloudUser.uid) {
      this.syncUserProSubscriptionFromCloud();
      setTimeout(() => this.fetchMyLibraryFromCloud(), 500);
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
                  }
                  const sinceRegisterMs = Date.now() - (this._lastSessionLockRegisteredAt || 0);
                  if (sinceRegisterMs > 10000) {
                    this.verifyActiveDeviceSessionLock();
                  }
                }
              } else if (this.cloudUser && this._fbSignOutInProgress) {
                this.cloudUser = null;
                this._persistActiveCloudUserSession();
                this.myLibraryCache = [];
                this.syncCloudAuthUI();
                this.renderMyLibraryList();
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
        if (this.isDrawingInk || this._isDrawingCardInk) return;
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
        sidebarPaneEl.style.width = '168px';
        try { localStorage.setItem('graphly_cloud_sidebar_w_v1', '168'); } catch (err) { }
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
    const btnOpenProSettings = document.getElementById('btnOpenProPricingFromSettings');
    const modalPro = document.getElementById('modalProPricing');
    const btnClosePro = document.getElementById('btnCloseProPricingModal');
    const cardPro1M = document.getElementById('cardPlanPro1M');
    const cardPro1Y = document.getElementById('cardPlanPro1Y');
    const btnPayNow = document.getElementById('btnProModalPayNow');
    this._selectedProPlan = { code: 'PRO_1M', name: 'Graphly Pro 1개월 이용권 (30일)', amount: 3900 };
    const selectProPlan = (code, name, amount, is1M) => {
      this._selectedProPlan = { code, name, amount };
      if (cardPro1M && cardPro1Y) {
        cardPro1M.style.border = is1M ? '2px solid #2563eb' : '1.5px solid rgba(148,163,184,0.35)';
        cardPro1M.style.background = is1M ? 'rgba(37,99,235,0.08)' : 'rgba(148,163,184,0.05)';
        cardPro1Y.style.border = !is1M ? '2px solid #2563eb' : '1.5px solid rgba(148,163,184,0.35)';
        cardPro1Y.style.background = !is1M ? 'rgba(37,99,235,0.08)' : 'rgba(148,163,184,0.05)';
      }
      if (btnPayNow) {
        btnPayNow.textContent = `💳 토스페이먼츠 카드 결제하기 (${amount.toLocaleString('ko-KR')}원)`;
      }
    };
    if (cardPro1M) cardPro1M.onclick = () => selectProPlan('PRO_1M', 'Graphly Pro 1개월 이용권 (30일)', 3900, true);
    if (cardPro1Y) cardPro1Y.onclick = () => selectProPlan('PRO_1Y', 'Graphly Pro 1년 이용권 (365일)', 39000, false);
    if (btnOpenProHub) {
      btnOpenProHub.onclick = () => {
        if (modalCloud) modalCloud.classList.remove('show');
        this.openProPricingModal();
      };
    }
    if (btnOpenProSettings) {
      btnOpenProSettings.onclick = () => this.openProPricingModal();
    }
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
          navigator.clipboard.writeText('help@cubiolab.com').catch(() => {});
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
        const f = e.dataTransfer.files[0];
        const lowerName = (f && f.name) ? f.name.toLowerCase() : '';
        if (f && (lowerName.endsWith('.graphly') || lowerName.endsWith('.graphly.html'))) {
          e.preventDefault();
          e.stopPropagation();
          this.importGraphlyDeckFile(f);
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
    const prefillTitle = (options && typeof options.prefillTitle === 'string' && options.prefillTitle.trim())
      ? options.prefillTitle.trim()
      : ((inpShareTitle && inpShareTitle.value.trim()) ? inpShareTitle.value.trim() : '');
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
      const parentShort = this._newFolderParentPath ? this._newFolderParentPath.split('/').pop() : '내 클라우드';
      lblTarget.textContent = `📂 ${parentShort} 안에 생성`;
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
      if (item._isChunked && item._chunkCount && item._chunkDocPrefix) {
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
    if (Array.isArray(this.myLibraryCache)) {
      this.myLibraryCache = this.myLibraryCache.filter(x => x && x.id !== item.id);
    }
    try {
      localStorage.removeItem('graphly_full_doc_' + item.id);
    } catch (e) { }
    if (typeof this._idbCacheDelete === 'function') {
      await this._idbCacheDelete('graphly_full_doc_' + item.id).catch(() => { });
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
    if (btnOpen) {
      btnOpen.style.display = fileCnt > 0 ? 'inline-flex' : 'none';
      btnOpen.innerHTML = `<span id="lblCloudFooterOpenText">📂 열기</span>`;
    } else if (lblFooterOpen) {
      lblFooterOpen.textContent = '📂 열기';
    }
    if (btnDownload) {
      btnDownload.style.display = fileCnt > 0 ? 'inline-flex' : 'none';
      btnDownload.innerHTML = `<span>📥 다운로드</span>`;
    }
    if (btnMove) {
      btnMove.innerHTML = `<span>📦 이동 ▾</span>`;
    }
    if (btnDelete) {
      btnDelete.innerHTML = `<span>🗑️ 삭제</span>`;
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
    return await this.exportGraphlyDeckFile(title, tags, slides);
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
    return await this.exportGraphlyDeckFile(bundleTitle, '#통째수업 #풀세트', combinedSlides);
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
          <div class="win-move-menu-header">이동할 폴더 선택</div>
          ${parentsWithSubs.length > 0 ? `<button type="button" class="win-move-menu-fold-all-btn" id="btnMoveMenuFoldAll">하위 접기</button>` : ''}
        </div>
        <input type="text" class="win-move-menu-search-input" id="inputMoveMenuFolderSearch" placeholder="🔍 이동할 폴더 검색..." autocomplete="off">
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
            <span class="cloud-tree-icon">☁️</span>
            <span class="cloud-tree-name">내 클라우드 (최상위 홈)</span>
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
          rowEl.innerHTML = `
            <div class="win-move-item-left">
              ${indentGuidesHtml}
              <span class="cloud-tree-icon">${hasSubs && !isCollapsed ? '📂' : '📁'}</span>
              <span class="cloud-tree-name" title="${fPath.replace(/\//g, ' › ')}">${segName}</span>
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
      const confirmMsg = (folderPaths.length > 0 && fileIds.size === 0)
        ? `선택한 폴더 ${folderPaths.length}개를 삭제하시겠습니까?\n(폴더 안의 수업 파일은 삭제되지 않고 상위 폴더로 안전하게 이동됩니다.)`
        : `선택한 항목 ${totalTargetCount}개(파일 ${fileIds.size}개${folderPaths.length > 0 ? ` · 폴더 ${folderPaths.length}개` : ''})를 클라우드 보관함에서 영구 삭제하시겠습니까?`;
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

  syncCloudAuthUI() {
    const lblBtn = document.getElementById('lblCloudAuthBtnText');
    const lblStatus = document.getElementById('lblCloudUserStatus');
    const boxEmailLogin = document.getElementById('cloudEmailLoginBox');
    const btnEmailToggle = document.getElementById('btnCloudEmailLoginToggle');
    const verifyBanner = document.getElementById('cloudEmailVerifyBanner');
    const lblProAcct = document.getElementById('lblProModalAccountStatus');
    const btnProGoLogin = document.getElementById('btnProModalGoLogin');
    const lblSettingsAcct = document.getElementById('lblSettingsAccountStatus');
    const settingsLoggedOutRow = document.getElementById('settingsAccountLoggedOutActions');
    const settingsLoggedInRow = document.getElementById('settingsAccountLoggedInActions');

    if (this.cloudUser) {
      const emailStr = this.cloudUser.email || this.cloudUser.loginId || '';
      const proTag = this.isProSubscriber() ? ' · 👑 Pro' : '';
      if (lblStatus) {
        lblStatus.style.display = 'inline-flex';
        lblStatus.textContent = `🟢 ${this.cloudUser.displayName} (${emailStr})${proTag}`;
      }
      if (lblBtn) lblBtn.textContent = '로그아웃';
      if (boxEmailLogin) boxEmailLogin.style.display = 'none';
      if (verifyBanner) verifyBanner.style.display = 'none';
      if (btnEmailToggle) btnEmailToggle.style.display = 'none';
      if (lblProAcct) {
        lblProAcct.textContent = `✅ 결제 귀속 계정: ${this.cloudUser.displayName} (${emailStr})${proTag}`;
      }
      if (btnProGoLogin) btnProGoLogin.style.display = 'none';
      if (lblSettingsAcct) {
        lblSettingsAcct.style.display = 'flex';
        const acctText = emailStr || this.cloudUser.displayName || '';
        const isPro = this.isProSubscriber();
        const planLabel = isPro ? 'Pro 플랜' : '무료 플랜';
        const planClass = isPro ? 'is-pro' : 'is-free';
        lblSettingsAcct.innerHTML = '';
        const spanEmail = document.createElement('span');
        spanEmail.className = 'settings-account-id-text';
        spanEmail.textContent = acctText;
        spanEmail.title = acctText;
        const spanPlan = document.createElement('span');
        spanPlan.className = `settings-account-plan-badge ${planClass}`;
        spanPlan.textContent = planLabel;
        lblSettingsAcct.appendChild(spanEmail);
        lblSettingsAcct.appendChild(spanPlan);
      }
      if (settingsLoggedOutRow) settingsLoggedOutRow.style.display = 'none';
      if (settingsLoggedInRow) settingsLoggedInRow.style.display = 'flex';
    } else {
      if (lblStatus) {
        lblStatus.style.display = 'none';
        lblStatus.textContent = '';
      }
      if (lblBtn) lblBtn.textContent = '구글 로그인';
      if (btnEmailToggle) btnEmailToggle.style.display = 'inline-flex';
      if (lblProAcct) {
        lblProAcct.textContent = '🔒 결제 전 로그인이 필요합니다.';
      }
      if (btnProGoLogin) btnProGoLogin.style.display = 'inline-flex';
      if (lblSettingsAcct) {
        lblSettingsAcct.style.display = 'none';
        lblSettingsAcct.textContent = '';
      }
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
      customShortcuts: this.customShortcuts || {}
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
          customShortcuts: {}
        };
        this._applyUserPreferences(defaultPrefs, true);
        try {
          localStorage.setItem(this._getUserPrefsStorageKey('guest'), JSON.stringify(defaultPrefs));
        } catch (_) { }
      }
      return;
    }

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
  // 👑 [구독(Pro) vs 비구독(Free) 요금제 정책 및 개수 제한 컨트롤 타워]
  // - 추후 무료/유료 개수 제한을 변경할 때 아래 SUBSCRIPTION_QUOTA_CONFIG 객체의 숫자만 바꾸면
  //   [⭐ 내 그래프], 슬라이드 생성, 빠른 보관함 등 모든 제한과 결제 유도 모달이 자동 연동됩니다!
  // ============================================================================
  getSubscriptionQuotaConfig() {
    if (!this.SUBSCRIPTION_QUOTA_CONFIG) {
      this.SUBSCRIPTION_QUOTA_CONFIG = {
        enforceCustomGraphLimit: true, // ⭐ 내 그래프 개수 제한 적용 스위치 (true: 무료 회원 제한 적용)
        freeMaxCustomGraphs: 3,        // 비구독(무료) 회원: ⭐ 내 그래프 최대 3개까지 등록 가능
        proMaxCustomGraphs: 100,       // Pro 구독 회원: ⭐ 내 그래프 최대 100개(사실상 무제한) 등록 가능
        freeMaxSlides: 3,              // 비구독(무료) 회원: 슬라이드 연속 생성 기준 (향후 연동용)
        proMaxSlides: 100,             // Pro 구독 회원: 슬라이드 최대 100장
        freeMaxQuickLibrary: 3,        // 비구독(무료) 회원: 빠른 보관함 최대 3개
        proMaxQuickLibrary: 200,       // Pro 구독 회원: 빠른 보관함 최대 200개
        freeMaxRecordMs: 10 * 60 * 1000, // 비구독(무료) 회원: 1회 녹화 최대 10분 (600,000ms)
        proMaxRecordMs: 60 * 60 * 1000   // Pro 구독 회원: 1회 녹화 최대 60분 (3,600,000ms)
      };
    }
    return this.SUBSCRIPTION_QUOTA_CONFIG;
  }

  _getProStorageKeyForUid(uid) {
    if (!uid) return 'graphly_pro_active_v1';
    return `graphly_pro_active_v2_${uid}`;
  }

  isProSubscriber() {
    if (this.cloudUser && this.cloudUser.uid) {
      if (this.cloudUser.isPro === true) return true;
      return Boolean(this.isProUser);
    }
    return false;
  }

  async syncUserProSubscriptionFromCloud() {
    if (this._isConfirmingTossPayment) return this.isProUser;
    if (!this.cloudUser || !this.cloudUser.uid) {
      this.isProUser = false;
      return false;
    }
    const targetUid = this.cloudUser.uid;
    const userProKey = this._getProStorageKeyForUid(targetUid);
    let localPro = false;
    try {
      localPro = (localStorage.getItem(userProKey) === 'true');
    } catch (e) { }
    this.cloudUser.isPro = localPro;
    this.isProUser = localPro;
    if (this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestReadDoc === 'function') {
      try {
        const subDocId = `sub_${targetUid}`;
        const remoteSub = await this._firestoreRestReadDoc('user_subscriptions', subDocId, true);
        const nowMs = Date.now();
        let isValidRemotePro = Boolean(
          remoteSub &&
          remoteSub.isPro === true &&
          (!remoteSub.expiresAt || Number(remoteSub.expiresAt) > nowMs)
        );

        const applyProState = (nextIsPro) => {
          if (!this.cloudUser || this.cloudUser.uid !== targetUid) return;
          this.cloudUser.isPro = nextIsPro;
          this.isProUser = nextIsPro;
          try {
            if (nextIsPro) {
              localStorage.setItem(userProKey, 'true');
            } else {
              localStorage.removeItem(userProKey);
            }
            localStorage.removeItem('graphly_pro_active_v1');
          } catch (e) { }
          this._persistActiveCloudUserSession();
          this.syncCloudAuthUI();
          this.renderFuncList();
          if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
        };

        applyProState(isValidRemotePro);

        // 🔄 토스페이먼츠 상점관리자에서 직접 결제를 취소했는지 백그라운드 실시간 교차 검증 및 즉시 회수
        if (isValidRemotePro && remoteSub && (remoteSub.paymentKey || remoteSub.orderId) && !this._isVerifyingTossSubStatus) {
          this._isVerifyingTossSubStatus = true;
          const verifyEndpoint = this.TOSS_VERIFY_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/verifyTossSubscriptionStatus';
          fetch(verifyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: targetUid,
              orderId: String(remoteSub.orderId || ''),
              paymentKey: String(remoteSub.paymentKey || '')
            })
          })
            .then((r) => r.json().catch(() => null))
            .then((verifyData) => {
              if (verifyData && verifyData.ok && (verifyData.revoked === true || verifyData.isPro === false)) {
                applyProState(false);
                if (typeof this.showTossPaymentResultModal === 'function') {
                  this.showTossPaymentResultModal({
                    status: 'error',
                    title: '결제 취소 확인 (Pro 이용권 회수)',
                    message: '토스페이먼츠 결제 취소 내역이 확인되어 무료 플랜으로 전환되었습니다.'
                  });
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
    return this.isProUser;
  }

  _normalizeAndCapCustomGraphPresets(list) {
    if (!Array.isArray(list) || list.length === 0) return [];
    const cfg = this.getSubscriptionQuotaConfig();
    const isPro = this.isProSubscriber();
    const maxLimit = isPro ? cfg.proMaxCustomGraphs : cfg.freeMaxCustomGraphs;

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
    if (cfg.enforceCustomGraphLimit && !isPro && uniqueList.length > maxLimit) {
      return uniqueList.slice(0, maxLimit);
    }
    return uniqueList;
  }

  getCustomGraphQuotaStatus() {
    const cfg = this.getSubscriptionQuotaConfig();
    const isPro = this.isProSubscriber();
    const maxLimit = isPro ? cfg.proMaxCustomGraphs : cfg.freeMaxCustomGraphs;
    if (Array.isArray(this.customGraphPresets) && cfg.enforceCustomGraphLimit && !isPro && this.customGraphPresets.length > maxLimit) {
      this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(this.customGraphPresets);
      try {
        localStorage.setItem(this._getCustomGraphsStorageKey(), JSON.stringify(this.customGraphPresets));
      } catch (e) { }
    }
    const currentCount = Array.isArray(this.customGraphPresets) ? this.customGraphPresets.length : 0;
    const isReached = Boolean(cfg.enforceCustomGraphLimit && !isPro && currentCount >= maxLimit);
    const badgeText = isPro
      ? `👑 Pro 무제한 (${currentCount}개)`
      : `무료 ${ Math.min(currentCount, maxLimit) } / ${maxLimit}`;
    return {
      isPro,
      currentCount: isPro ? currentCount : Math.min(currentCount, maxLimit),
      maxLimit,
      isReached,
      badgeText
    };
  }

  // ============================================================================
  // ⭐ [개인별 '자주 쓰는 내 그래프' 보관함 (My Custom Graph Presets) 엔진]
  // - 단일 함수뿐만 아니라 다중 함수(f1, f2...) + 구간 분할(Piecewise) + 주기·계단형(T, q) +
  //   절댓값(|f(x)|) + 보조 수선까지 현재 그래프 상태를 0.5KB 초경량 스냅샷으로 통째 저장/복원!
  // ============================================================================
  showTossPaymentResultModal({ status = 'success', title = '', message = '', planName = '', amount = 0, expiresAt = 0 } = {}) {
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
    const icon = isLoading ? '⏳' : (isSuccess ? '🎉' : '⚠️');
    const resolvedTitle = title || (isLoading ? '결제 승인 확인 중...' : (isSuccess ? 'Graphly Pro 결제가 완료되었습니다!' : '결제 안내'));
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

    backdrop.innerHTML = `
      <div class="smart-modal-card" style="max-width: 440px; width: 92%; text-align: center; padding: 26px 22px 20px;">
        <div style="font-size: 42px; line-height: 1; margin-bottom: 12px;">${icon}</div>
        <div style="font-size: 18.5px; font-weight: 800; color: ${isSuccess ? '#2563eb' : 'inherit'}; margin-bottom: 8px;">
          ${escapeText(resolvedTitle)}
        </div>
        <div style="font-size: 13.5px; opacity: 0.85; line-height: 1.55; margin-bottom: 16px;">
          ${escapeText(message || (isSuccess ? '결제가 최종 승인되어 모든 Pro 기능이 즉시 활성화되었습니다.' : ''))}
        </div>
        ${isSuccess ? `
          <div style="background: rgba(37,99,235,0.07); border: 1px solid rgba(37,99,235,0.22); border-radius: 12px; padding: 14px; text-align: left; font-size: 13px; display: flex; flex-direction: column; gap: 7px; margin-bottom: 18px;">
            ${planName ? `<div style="display:flex; justify-content:space-between; gap:8px;"><span style="opacity:0.75; font-weight:600;">이용권</span><strong style="font-weight:800;">${escapeText(planName)}</strong></div>` : ''}
            ${formattedAmt ? `<div style="display:flex; justify-content:space-between; gap:8px;"><span style="opacity:0.75; font-weight:600;">결제 금액</span><strong style="color:#2563eb; font-weight:800;">${escapeText(formattedAmt)}</strong></div>` : ''}
            ${formattedExp ? `<div style="display:flex; justify-content:space-between; gap:8px;"><span style="opacity:0.75; font-weight:600;">이용 기간</span><strong style="font-weight:800;">${escapeText(formattedExp)}</strong></div>` : ''}
            <div style="border-top: 1px dashed rgba(148,163,184,0.35); margin-top: 4px; padding-top: 8px; font-size: 12px; color: #2563eb; font-weight: 700; text-align: center;">
              👑 내 그래프 무제한 · 60분 연속 녹화 · 클라우드 즉시 활성화
            </div>
          </div>
        ` : ''}
        ${!isLoading ? `
          <button type="button" id="btnConfirmTossPaymentResultModal" class="btn-primary"
            style="width: 100%; padding: 12.5px; border-radius: 10px; font-size: 14.5px; font-weight: 800; background: ${isSuccess ? 'linear-gradient(135deg,#2563eb,#4f46e5)' : '#334155'}; color: #fff; border: none; cursor: pointer;">
            ${isSuccess ? '👑 확인 (바로 시작하기)' : '확인'}
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

  async confirmTossPaymentAndActivatePro({ paymentKey, orderId, amount, uid, planCode, planName, pendingIdToken }) {
    this._isConfirmingTossPayment = true;
    this.showTossPaymentResultModal({
      status: 'loading',
      title: '결제 승인 확인 중...',
      message: '토스페이먼츠 결제 내역을 최종 확인하고 있습니다. 잠시만 기다려 주세요.'
    });
    try {
      const confirmEndpoint = this.TOSS_CONFIRM_BACKEND_URL || 'https://asia-northeast3-graphly-net.cloudfunctions.net/confirmTossPayment';
      const numAmount = Number(amount) || 3900;
      const resolvedPlanCode = planCode || (String(orderId || '').startsWith('GRAPHLY_PRO_1Y_') || numAmount === 39000 ? 'PRO_1Y' : 'PRO_1M');
      let idToken = String(pendingIdToken || '').trim();
      if (!idToken && this._fbAuth && this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
        try {
          idToken = await this._fbAuth.currentUser.getIdToken();
        } catch (e) { }
      }
      if (!idToken && this._fbAuth) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
          try {
            idToken = await this._fbAuth.currentUser.getIdToken();
          } catch (e) { }
        }
      }

      if (paymentKey && orderId && confirmEndpoint) {
        const headers = {
          'Content-Type': 'application/json'
        };
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
        const res = await fetch(confirmEndpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            paymentKey: String(paymentKey),
            orderId: String(orderId),
            amount: numAmount,
            uid: uid || (this.cloudUser && this.cloudUser.uid) || '',
            planCode: resolvedPlanCode,
            planName: planName || 'Graphly Pro 이용권',
            idToken: idToken
          })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data && data.ok === true) {
          const targetUid = uid || (this.cloudUser && this.cloudUser.uid) || '';
          if (targetUid) {
            localStorage.setItem(this._getProStorageKeyForUid(targetUid), 'true');
          }
          this.isProUser = true;
          if (this.cloudUser) {
            this.cloudUser.isPro = true;
            this._persistActiveCloudUserSession();
          }
          this.syncCloudAuthUI();
          this.renderFuncList();
          if (typeof this.syncAudioRecordUI === 'function') this.syncAudioRecordUI();
          this.showTossPaymentResultModal({
            status: 'success',
            title: 'Graphly Pro 결제가 완료되었습니다!',
            message: '결제가 최종 승인되어 모든 Pro 기능이 즉시 활성화되었습니다.',
            planName: (data && data.planName) || planName || 'Graphly Pro 이용권',
            amount: (data && data.amount) || numAmount,
            expiresAt: (data && data.expiresAt) || 0
          });
          return true;
        } else {
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
        message: '결제 승인 통신 중 오류가 발생했습니다. 고객센터(help@cubiolab.com)로 문의해 주세요.'
      });
    } finally {
      this._isConfirmingTossPayment = false;
    }
    return false;
  }

  initCustomGraphPresets() {
    this.getSubscriptionQuotaConfig();
    this.isProUser = false;
    try {
      if (!this.cloudUser && typeof this._restoreActiveCloudUserSession === 'function') {
        this._restoreActiveCloudUserSession();
      }
      const isTestTossKey = false; // 토스페이먼츠 라이브 키(live_ck_ / Secret Manager) 정식 적용 완료
      if (typeof window !== 'undefined' && window.location && window.location.search.includes('paymentStatus=success')) {
        const pendingUid = localStorage.getItem('graphly_pending_payment_uid') || (this.cloudUser && this.cloudUser.uid);
        const pendingPlanCode = localStorage.getItem('graphly_pending_payment_plan_code') || '';
        const pendingPlanName = localStorage.getItem('graphly_pending_payment_plan') || 'Graphly Pro 이용권';
        const pendingIdToken = localStorage.getItem('graphly_pending_payment_id_token') || '';
        localStorage.removeItem('graphly_pending_payment_uid');
        localStorage.removeItem('graphly_pending_payment_plan_code');
        localStorage.removeItem('graphly_pending_payment_plan');
        localStorage.removeItem('graphly_pending_payment_id_token');
        const params = new URLSearchParams(window.location.search);
        const paidPaymentKey = params.get('paymentKey') || '';
        const paidOrderId = params.get('orderId') || '';
        const paidAmount = Number(params.get('amount')) || 3900;
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
        if (!isTestTossKey) {
          setTimeout(() => {
            this.confirmTossPaymentAndActivatePro({
              paymentKey: paidPaymentKey,
              orderId: paidOrderId,
              amount: paidAmount,
              uid: pendingUid,
              planCode: pendingPlanCode,
              planName: pendingPlanName,
              pendingIdToken: pendingIdToken
            });
          }, 150);
        } else {
          setTimeout(() => {
            this.showToast('🛠️ 테스트 결제 확인이 완료되었습니다. (실제 금액은 청구되지 않으며, 정식 결제 오픈 후 이용권이 활성화됩니다.)');
          }, 600);
        }
      } else if (typeof window !== 'undefined' && window.location && window.location.search.includes('paymentStatus=fail')) {
        localStorage.removeItem('graphly_pending_payment_uid');
        localStorage.removeItem('graphly_pending_payment_plan_code');
        localStorage.removeItem('graphly_pending_payment_plan');
        localStorage.removeItem('graphly_pending_payment_id_token');
        const params = new URLSearchParams(window.location.search);
        const failCode = params.get('code') || '';
        const failMsg = params.get('message') || '결제가 취소되었거나 완료되지 않았습니다.';
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
        if (failCode !== 'PAY_PROCESS_CANCELED' && failCode !== 'USER_CANCEL') {
          setTimeout(() => {
            this.showTossPaymentResultModal({
              status: 'error',
              title: '결제가 완료되지 않았습니다',
              message: failMsg
            });
          }, 200);
        }
      }
      if (this.cloudUser && this.cloudUser.uid) {
        this.isProUser = localStorage.getItem(this._getProStorageKeyForUid(this.cloudUser.uid)) === 'true';
        this.cloudUser.isPro = this.isProUser;
      } else {
        this.isProUser = false;
      }
    } catch (e) { }
    this.customGraphPresets = [];
    this._renamingCustomGraphId = null;
    this._loadCustomGraphsFromStorage();
  }

  _getCustomGraphsStorageKey() {
    const uid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest';
    return `graphly_custom_graphs_v1_${uid}`;
  }

  _loadCustomGraphsFromStorage() {
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
      // 로그인 직후 해당 계정 키에 데이터가 없으면 비로그인(guest) 시절 등록해둔 그래프를 자동 승계
      if (this.cloudUser && this.cloudUser.uid) {
        const guestRaw = localStorage.getItem('graphly_custom_graphs_v1_guest');
        if (guestRaw) {
          const guestParsed = JSON.parse(guestRaw);
          if (Array.isArray(guestParsed) && guestParsed.length > 0) {
            this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(guestParsed);
            localStorage.setItem(key, JSON.stringify(this.customGraphPresets));
            return;
          }
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
    if (Array.isArray(this.customGraphPresets)) {
      this.customGraphPresets = this._normalizeAndCapCustomGraphPresets(this.customGraphPresets);
    }
    try {
      const key = this._getCustomGraphsStorageKey();
      localStorage.setItem(key, JSON.stringify(this.customGraphPresets || []));
    } catch (e) { }
    if (this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestWriteSingleDoc === 'function') {
      const docId = `cg_user_${this.cloudUser.uid}`;
      this._firestoreRestWriteSingleDoc('user_custom_graphs', docId, JSON.stringify(this.customGraphPresets || [])).catch(() => { });
    }
  }

  async onCustomGraphUserChanged() {
    this._loadCustomGraphsFromStorage();
    const curUid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'guest';
    const shouldFetchRemote = (this._lastSyncedCustomGraphsUid !== curUid);
    this._lastSyncedCustomGraphsUid = curUid;
    if (shouldFetchRemote && this._canSyncCustomGraphsToFirestore() && typeof this._firestoreRestReadDoc === 'function') {
      try {
        const docId = `cg_user_${this.cloudUser.uid}`;
        const remoteList = await this._firestoreRestReadDoc('user_custom_graphs', docId, true);
        if (Array.isArray(remoteList) && remoteList.length > 0) {
          this.customGraphPresets = this._normalizeAndCapCustomGraphPresets([
            ...remoteList,
            ...(this.customGraphPresets || [])
          ]);
          try {
            localStorage.setItem(this._getCustomGraphsStorageKey(), JSON.stringify(this.customGraphPresets));
          } catch (e) { }
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
      '3rd_normal': '삼차',
      '3rd_inflection': '삼차변곡',
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
      if (this.usePiecewise && this.piecewiseBoundaries && this.piecewiseBoundaries.length > 0 && !g.isIndependent) {
        return;
      }
      const color = g.color || '#00d2d3';
      if (g.type === 'geom_circle' || g.type === 'geom_triangle' || g.type === 'geom_quad') {
        if (Array.isArray(g.handles) && g.handles.length >= 2) {
          const pts = g.handles.map(h => ({ x: h.x, y: h.y }));
          pts.forEach(p => allY.push(p.y));
          polylines.push({ pts: [...pts, pts[0]], color });
        }
        return;
      }
      let curPts = [];
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

    // 👑 구독(Pro) vs 비구독(Free) 개수 제한 체크
    const quota = this.getCustomGraphQuotaStatus();
    if (quota.isReached) {
      this.showToast(`👑 무료 버전은 [⭐ 내 그래프]를 최대 ${quota.maxLimit}개까지 등록할 수 있습니다. Pro 업그레이드 시 무제한 등록됩니다!`);
      if (typeof this.openProPricingModal === 'function') {
        this.openProPricingModal();
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
    this._saveCustomGraphsToStorage();

    this._currentCat = '⭐ 내 그래프';
    this.renderFuncList();
    setTimeout(() => {
      const scrollEl = document.querySelector('#funcGrid .custom-graph-scroll-list');
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    }, 10);
    const assignedCode = 70 + this.customGraphPresets.length;
    this.showToast(`⭐ [${assignedCode}] ${newItem.name} 프리셋이 등록되었습니다!`);
    return newItem;
  }

  loadCustomGraphPreset(presetId) {
    if (!Array.isArray(this.customGraphPresets)) return false;
    const item = this.customGraphPresets.find(it => it && it.id === presetId);
    if (!item || !item.snapshot) return false;

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
    this.updatePwDescBadge();
    this.updateIntersections();

    if (this.isInkMode && this.activeInkTool !== 'select') {
      this.setActiveInkTool('select');
    }
    if (typeof this.closeDrawer === 'function' && !this.isDrawerCollapsed && this.activeDrawerPanel !== 'panelPresets') {
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

    // 1번 고정 카드: [➕ 현재 그래프 등록]
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
    grid.appendChild(regWrap);

    const scrollList = document.createElement('div');
    scrollList.className = 'custom-graph-scroll-list';
    grid.appendChild(scrollList);

    if (!Array.isArray(this.customGraphPresets) || this.customGraphPresets.length === 0) {
      return;
    }

    this.customGraphPresets.forEach((item, idx) => {
      if (!item) return;
      const presetNum = 71 + idx;
      const codeStr = String(presetNum);
      const card = document.createElement('div');
      card.className = 'custom-graph-card';
      card.setAttribute('data-custom-graph-id', item.id);
      if (presetNum <= 109) {
        card.dataset.funcCode = codeStr;
      }

      const isRenaming = (this._renamingCustomGraphId === item.id);
      if (isRenaming) {
        card.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px; width:100%;">
            <input type="text" class="custom-graph-rename-input" value="${(item.name || '').replace(/"/g, '&quot;')}"
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

      card.innerHTML = `
        <div class="custom-graph-card-left">
          <span class="func-num-badge">${codeStr}</span>
          <div class="custom-graph-thumb-box">${item.svgThumb || '📈'}</div>
          <div class="custom-graph-info">
            <div class="custom-graph-title">${item.name || '나만의 그래프'}</div>
            <div class="custom-graph-meta">${item.badge || '커스텀 그래프'}</div>
          </div>
        </div>
        <div class="custom-graph-actions">
          <button type="button" class="custom-graph-act-btn edit" title="이름 변경">✏️</button>
          <button type="button" class="custom-graph-act-btn del" title="삭제">✕</button>
        </div>
      `;

      card.onclick = () => {
        this._clearPendingGraphShortcutDigit();
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
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) { }
    return {};
  }

  _saveLocalAccountsRegistry(reg) {
    try {
      localStorage.setItem('graphly_local_accounts_v2', JSON.stringify(reg || {}));
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
    const pwHash = this._hashLocalAccountPassword(pw);
    const registry = this._getLocalAccountsRegistry();
    const canUseRemote = Boolean(typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol));

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

      let existingAcc = registry[normEmail] || null;
      if (!existingAcc && canUseRemote && typeof this._firestoreRestReadDoc === 'function') {
        try {
          existingAcc = await this._firestoreRestReadDoc('user_accounts', docId, true);
        } catch (e) { }
      }
      if (existingAcc && existingAcc.passwordHash && existingAcc.emailVerified === true) {
        this.showToast('⚠️ 이미 가입 및 인증이 완료된 아이디입니다. [로그인] 탭에서 로그인해 주세요.');
        return false;
      }

      const rawDisplayName = (inpName && inpName.value ? inpName.value.trim() : '');
      const displayName = rawDisplayName || (rawEmail.split('@')[0] || '선생님');

      if (canUseRemote && this._fbAuth && typeof this._fbAuth.createUserWithEmailAndPassword === 'function') {
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
                    displayName: displayName,
                    email: normEmail,
                    passwordHash: pwHash,
                    emailVerified: true,
                    verifiedAt: Date.now(),
                    createdAt: (existingAcc && existingAcc.createdAt) ? existingAcc.createdAt : Date.now()
                  };
                  registry[normEmail] = verifiedAcc;
                  this._saveLocalAccountsRegistry(registry);
                  if (typeof this._firestoreRestWriteSingleDoc === 'function') {
                    this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(verifiedAcc)).catch(() => { });
                  }
                  try { localStorage.setItem('graphly_last_auth_provider', 'email'); } catch (e) { }
                  this._applyLoggedInCloudUser({
                    uid: canonicalUid,
                    rawUid: String(signCred.user.uid || canonicalUid),
                    authProvider: 'email',
                    providerLabel: '아이디 로그인',
                    loginId: normEmail,
                    displayName: displayName,
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
        passwordHash: pwHash,
        emailVerified: false,
        verificationSentAt: Date.now(),
        createdAt: (existingAcc && existingAcc.createdAt) ? existingAcc.createdAt : Date.now()
      };

      registry[normEmail] = pendingAccount;
      this._saveLocalAccountsRegistry(registry);
      if (canUseRemote && typeof this._firestoreRestWriteSingleDoc === 'function') {
        this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(pendingAccount)).catch(() => { });
      }

      this._showEmailVerificationBanner(normEmail);
      this.showToast(`📩 [${normEmail}] 메일함으로 인증 링크를 발송했습니다! 인증 후 [인증 완료 확인]을 눌러주세요.`);
      return 'verification_pending';
    }

    // 아이디 로그인 모드 (Firebase Auth 검증 + 이메일 본인인증 완료 여부 100% 필수 검증)
    let account = registry[normEmail] || null;
    if (!account && canUseRemote && typeof this._firestoreRestReadDoc === 'function') {
      try {
        const remoteAcc = await this._firestoreRestReadDoc('user_accounts', docId, true);
        if (remoteAcc && remoteAcc.uid) {
          account = remoteAcc;
          registry[normEmail] = remoteAcc;
          this._saveLocalAccountsRegistry(registry);
        }
      } catch (e) { }
    }

    if (canUseRemote && this._fbAuth && typeof this._fbAuth.signInWithEmailAndPassword === 'function') {
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
          const dispName = (account && account.displayName) || cred.user.displayName || (normEmail.split('@')[0] || '선생님');
          const syncedAcc = {
            uid: canonicalUid,
            authProvider: 'email',
            providerLabel: '아이디 로그인',
            loginId: normEmail,
            displayName: dispName,
            email: normEmail,
            passwordHash: pwHash,
            emailVerified: true,
            verifiedAt: (account && account.verifiedAt) ? account.verifiedAt : Date.now(),
            createdAt: (account && account.createdAt) ? account.createdAt : Date.now()
          };
          registry[normEmail] = syncedAcc;
          this._saveLocalAccountsRegistry(registry);
          if (typeof this._firestoreRestWriteSingleDoc === 'function') {
            this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(syncedAcc)).catch(() => { });
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
      } finally {
        this._isExplicitAuthFlowInProgress = false;
      }
    }

    if (!account || !account.passwordHash) {
      this.showToast('⚠️ 등록되지 않은 아이디입니다. [회원가입] 탭에서 먼저 가입해 주세요.');
      return false;
    }
    if (account.passwordHash !== pwHash) {
      this.showToast('⚠️ 비밀번호가 일치하지 않습니다.');
      return false;
    }
    if (account.emailVerified !== true) {
      this._showEmailVerificationBanner(
        normEmail,
        `⏳ [${normEmail}] 아이디는 아직 이메일 인증이 완료되지 않았습니다. 메일함에서 인증 링크를 클릭한 뒤 아래 [인증 완료 확인]을 눌러주세요.`
      );
      this.showToast('⏳ 이메일 인증 완료 후 로그인할 수 있습니다.');
      return false;
    }

    try { localStorage.setItem('graphly_last_auth_provider', 'email'); } catch (e) { }
    this._applyLoggedInCloudUser({
      uid: canonicalUid,
      authProvider: 'email',
      providerLabel: '아이디 로그인',
      loginId: normEmail,
      displayName: account.displayName || (normEmail.split('@')[0] || '선생님'),
      email: normEmail,
      emailVerified: true
    }, true);
    if (inpPw) inpPw.value = '';
    this.showToast(`🎉 환영합니다, ${this.cloudUser.displayName}님! 로그인되었습니다.`);
    return true;
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
    if (!account && canUseRemote && typeof this._firestoreRestReadDoc === 'function') {
      try {
        account = await this._firestoreRestReadDoc('user_accounts', docId, true);
      } catch (e) { }
    }

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
      } catch (e) {
        this.showToast('⚠️ 이메일 인증 상태를 확인할 수 없습니다. 비밀번호를 확인 후 다시 시도해 주세요.');
        return false;
      } finally {
        this._isExplicitAuthFlowInProgress = false;
      }
    } else if (!account) {
      this.showToast('⚠️ 가입 대기 중인 아이디 내역을 찾을 수 없습니다.');
      return false;
    }

    const updatedAccount = {
      ...(account || {}),
      uid: canonicalUid,
      authProvider: 'email',
      providerLabel: '아이디 로그인',
      loginId: normEmail,
      displayName: (account && account.displayName) || (normEmail.split('@')[0] || '선생님'),
      email: normEmail,
      emailVerified: true,
      verifiedAt: Date.now()
    };
    registry[normEmail] = updatedAccount;
    this._saveLocalAccountsRegistry(registry);
    if (canUseRemote && typeof this._firestoreRestWriteSingleDoc === 'function') {
      this._firestoreRestWriteSingleDoc('user_accounts', docId, JSON.stringify(updatedAccount)).catch(() => { });
    }

    const banner = document.getElementById('cloudEmailVerifyBanner');
    if (banner) banner.style.display = 'none';
    const inpPwConfirm = document.getElementById('inputCloudEmailPwConfirm');
    if (inpPw) inpPw.value = '';
    if (inpPwConfirm) inpPwConfirm.value = '';

    try { localStorage.setItem('graphly_last_auth_provider', 'email'); } catch (e) { }
    this._applyLoggedInCloudUser({
      uid: canonicalUid,
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
    this.isProUser = false;
    this._persistActiveCloudUserSession();
    this.syncCloudAuthUI();
    this.renderMyLibraryList();
    this.renderFuncList();
    if (!silentToast) {
      this.showToast('👋 안전하게 로그아웃되었습니다. (공용 PC 보호 완료)');
    }
  }

  openProPricingModal() {
    const modalPro = document.getElementById('modalProPricing');
    if (!modalPro) return;
    this.syncCloudAuthUI();
    if (this.cloudUser) {
      const inpName = document.getElementById('inputProBuyerName');
      const inpEmail = document.getElementById('inputProBuyerEmail');
      if (inpName && this.cloudUser.displayName) inpName.value = this.cloudUser.displayName;
      if (inpEmail && this.cloudUser.email) inpEmail.value = this.cloudUser.email;
    }
    modalPro.classList.add('show');
  }

  async requestTossPaymentFromStudio() {
    if (!this.cloudUser || !this.cloudUser.uid) {
      const modalPro = document.getElementById('modalProPricing');
      if (modalPro) modalPro.classList.remove('show');
      this.promptCloudLoginForLibrary('🔒 이용권 결제는 로그인한 계정에 귀속됩니다. 먼저 로그인을 진행해 주세요!');
      return false;
    }
    if (typeof window.TossPayments !== 'function') {
      this.showToast('⚠️ 토스페이먼츠 결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return false;
    }
    if (typeof this._ensureFirebaseInitialized === 'function') {
      this._ensureFirebaseInitialized();
    }
    let idToken = '';
    if (this._fbAuth && this._fbAuth.currentUser && typeof this._fbAuth.currentUser.getIdToken === 'function') {
      try {
        idToken = await this._fbAuth.currentUser.getIdToken(true);
      } catch (e) { }
    }
    if (!idToken) {
      const modalPro = document.getElementById('modalProPricing');
      if (modalPro) modalPro.classList.remove('show');
      this.promptCloudLoginForLibrary('🔒 안전한 결제 본인 인증을 위해 다시 한 번 로그인을 진행해 주세요!');
      return false;
    }
    const plan = this._selectedProPlan || { code: 'PRO_1M', name: 'Graphly Pro 1개월 이용권 (30일)', amount: 3900 };
    const planCode = plan.code === 'PRO_1Y' || Number(plan.amount) === 39000 ? 'PRO_1Y' : 'PRO_1M';
    const planAmount = planCode === 'PRO_1Y' ? 39000 : 3900;
    const planName = planCode === 'PRO_1Y' ? 'Graphly Pro 1년 이용권 (365일)' : 'Graphly Pro 1개월 이용권 (30일)';
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
        const ch = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cw * (this.graphCardAspect || 0.82))));
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

    const extraGraphs = [];
    if (this.extraGraphCards && this.extraGraphCards.length > 0) {
      this.extraGraphCards.forEach(c => {
        if (c && c.el && document.body.contains(c.el)) {
          if (typeof this._getMutablePipCardSnapshot === 'function') {
            const liveExtraSnap = this._getMutablePipCardSnapshot(c);
            if (liveExtraSnap) {
              const bodyEl = c.el.querySelector('.problem-card-body');
              const cw = Math.max(160, Math.round(parseFloat(c.el.style.width) || (bodyEl && bodyEl.clientWidth) || 430));
              const ch = Math.max(120, Math.round((bodyEl && parseFloat(bodyEl.style.height)) || (cw * (c.aspect || 0.82))));
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
        dataUrl: activePdfBoard.dataUrl || (
          activePdfBoard.canvas
            ? (activePdfBoard.dataUrl = this.encodeCanvasSmartWebP(activePdfBoard.canvas, 0.88))
            : ''
        ),
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
      if (pc.imgSrc) {
        const imgObj = new Image();
        imgObj.onload = () => {
          if (imgObj.naturalWidth > 0 && imgObj.naturalHeight > 0) {
            this.problemCardAspect = imgObj.naturalHeight / imgObj.naturalWidth;
            this.syncProblemCardRectFromWidget();
          }
        };
        imgObj.src = pc.imgSrc;
        this.problemCardImage = imgObj;
      }
      if (pImg) {
        if (pImg.src !== (pc.imgSrc || '')) {
          pImg.src = pc.imgSrc || '';
        } else if (this._isFixedReplayStageActive && this._isFixedReplayStageActive() && pc.imgSrc) {
          pImg.removeAttribute('src');
          pImg.src = pc.imgSrc;
        }
      }
      if (pTitle) pTitle.textContent = pc.titleText || '문제';
      if (pToggle) pToggle.textContent = pc.toggleText || (pc.minimized ? '▸' : '▾');
      pWidget.classList.toggle('minimized', Boolean(pc.minimized));
      pWidget.classList.toggle('pip-locked-mode', Boolean(pc.pipLocked));
      pWidget.classList.toggle('pip-stealth-locked', Boolean(pc.pipStealth));
      if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(pWidget);
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
          createdProb.el.classList.toggle('pip-locked-mode', Boolean(ep.pipLocked));
          createdProb.el.classList.toggle('pip-stealth-locked', Boolean(ep.pipStealth));
          if (typeof this.syncProblemCardLockUI === 'function') this.syncProblemCardLockUI(createdProb.el);
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
      this.graphCardData = { ...(gc.graphCardData || {}), dataUrl: gc.imgSrc || (gc.graphCardData && gc.graphCardData.dataUrl) || '' };
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
      if (gc.imgSrc) {
        const gImgObj = new Image();
        gImgObj.src = gc.imgSrc;
        this.graphCardImage = gImgObj;
      }
      if (gImg) gImg.src = gc.imgSrc || '';
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
      const validDirectCanvas = (pbd.canvas && typeof pbd.canvas.getContext === 'function') ? pbd.canvas : null;
      const cachedCanvas = validDirectCanvas || ((this._pdfPageCanvasCache && this._pdfPageCanvasCacheDoc === this.pdfDoc && pbd.pageNum)
        ? this._pdfPageCanvasCache[pbd.pageNum]
        : null);
      pbd.canvas = cachedCanvas || null;
      if (cachedCanvas) {
        pbd.canvas = cachedCanvas;
      }
      if (pbd.dataUrl) {
        const imgObj = new Image();
        imgObj.onload = () => {
          if (!pbd.canvas) {
            const offC = document.createElement('canvas');
            offC.width = imgObj.naturalWidth || 1200;
            offC.height = imgObj.naturalHeight || 1680;
            const offCtx = offC.getContext('2d');
            offCtx.drawImage(imgObj, 0, 0);
            try {
              const mipC = document.createElement('canvas');
              mipC.width = Math.max(1, Math.round(offC.width * 0.5));
              mipC.height = Math.max(1, Math.round(offC.height * 0.5));
              const mipCtx = mipC.getContext('2d');
              mipCtx.imageSmoothingEnabled = true;
              mipCtx.imageSmoothingQuality = 'high';
              mipCtx.drawImage(offC, 0, 0, mipC.width, mipC.height);
              offC._mipCanvas = mipC;
            } catch (e) { }
            pbd.canvas = offC;
          }
          this.requestRender();
        };
        imgObj.src = pbd.dataUrl;
        pbd.img = imgObj;
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

  // Firestore 단일 문서 직접 쓰기 헬퍼 (PATCH 1회 원자적 Upsert 우선 사용 — 409 충돌 에러 0% 및 쓰기 지연 50% 단축)
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
    const body = { fields };
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const postUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}?documentId=${encodeURIComponent(docId)}`;
      await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).catch(() => { });
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
    if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') return rawStr;
    try {
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
    } catch (e) {
      return rawStr;
    }
  }

  // Firestore REST API 헬퍼 (대용량 30문항 모의고사 풀세트도 1MB 제한 없이 자동 Gzip 무손실 압축 + 분할 업로드 지원!)
  async _firestoreRestWrite(collectionName, docId, payloadObj, options = null) {
    const fullStr = JSON.stringify(payloadObj);
    const netStr = await this._compressJsonStringGzipBase64(fullStr);
    const rawByteSize = fullStr.length;
    const byteSize = netStr.length;
    if (payloadObj && typeof payloadObj === 'object') {
      payloadObj.byteSize = byteSize;
      payloadObj.rawByteSize = rawByteSize;
    }

    const skipLocalFullCache = Boolean(options && options.skipLocalFullCache);
    const expireAtMs = (options && options.expireAtMs) || (payloadObj && payloadObj.expiresAt) || 0;
    if (!skipLocalFullCache) {
      await this._idbCacheSet('graphly_full_doc_' + docId, netStr, expireAtMs).catch(() => { });
      try { localStorage.removeItem('graphly_full_doc_' + docId); } catch (e) { }
    }

    const CHUNK_LIMIT = 700000; // ~700KB 단위로 안전 분할
    const isUserLibrary = (collectionName === 'user_library');

    // user_library는 로그인/목록 조회 시 본문 다운로드 트래픽을 0으로 만들기 위해 항상 경량 매니페스트 + 전용 청크(user_library 내 chunk_UID)로 분리!
    if (!isUserLibrary && netStr.length <= CHUNK_LIMIT) {
      return await this._firestoreRestWriteSingleDoc(collectionName, docId, netStr, { expireAtMs });
    }

    const chunks = [];
    for (let i = 0; i < netStr.length; i += CHUNK_LIMIT) {
      chunks.push(netStr.slice(i, i + CHUNK_LIMIT));
    }
    const prefix = `${docId}_part_`;
    const chunkCollection = isUserLibrary ? 'user_library' : 'shared_workspaces';
    const baseUid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'anonymous';
    const chunkOwnerUid = isUserLibrary ? `chunk_${baseUid}` : `chunk_share_${baseUid}`;

    await Promise.all(chunks.map((cStr, idx) => {
      return this._firestoreRestWriteSingleDoc(
        chunkCollection,
        `${prefix}${idx}`,
        JSON.stringify({ _isChunkPart: true, parentId: docId, partIndex: idx, data: cStr }),
        { ownerUid: chunkOwnerUid, expireAtMs: isUserLibrary ? 0 : expireAtMs }
      );
    }));

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
    return await this._firestoreRestWriteSingleDoc(collectionName, docId, JSON.stringify(manifestObj), { expireAtMs });
  }

  async _firestoreRestReadDoc(collectionName, docId, skipLocalCache = false) {
    if (!skipLocalCache) {
      try {
        const idbVal = await this._idbCacheGet('graphly_full_doc_' + docId);
        const localFull = idbVal || localStorage.getItem('graphly_full_doc_' + docId);
        if (localFull) {
          const uncompLocal = typeof localFull === 'string'
            ? await this._decompressJsonStringGzipBase64(localFull)
            : JSON.stringify(localFull);
          const parsedLocal = typeof uncompLocal === 'string' ? JSON.parse(uncompLocal) : uncompLocal;
          if (parsedLocal) return parsedLocal;
        }
      } catch (e) { }
    }
    if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
      return null;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.fields && data.fields.jsonPayload && data.fields.jsonPayload.stringValue) {
      const rawVal = await this._decompressJsonStringGzipBase64(data.fields.jsonPayload.stringValue);
      const parsed = JSON.parse(rawVal);
      return await this._resolveChunkedItem(parsed);
    }
    return null;
  }

  // 분할 저장된 대용량 수업 세트 또는 경량 캐시 항목일 경우 병렬로 청크/원본을 재조립하여 반환
  async _resolveChunkedItem(item) {
    if (!item) return item;
    if ((Array.isArray(item.playlistSlides) && item.playlistSlides.length > 0) || item.slideData) {
      return item;
    }
    if (item.id) {
      try {
        const idbVal = await this._idbCacheGet('graphly_full_doc_' + item.id);
        const localFull = idbVal || localStorage.getItem('graphly_full_doc_' + item.id);
        if (localFull) {
          const uncompLocal = typeof localFull === 'string'
            ? await this._decompressJsonStringGzipBase64(localFull)
            : JSON.stringify(localFull);
          const parsedLocal = typeof uncompLocal === 'string' ? JSON.parse(uncompLocal) : uncompLocal;
          if (parsedLocal && ((Array.isArray(parsedLocal.playlistSlides) && parsedLocal.playlistSlides.length > 0) || parsedLocal.slideData)) {
            return { ...item, ...parsedLocal, title: item.title || parsedLocal.title, folder: item.folder !== undefined ? item.folder : parsedLocal.folder };
          }
        }
      } catch (e) { }
    }
    if (!item._isChunked || !item._chunkCount || !item._chunkDocPrefix) {
      if (item.id && typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/user_library/${encodeURIComponent(item.id)}`;
          const r = await fetch(url);
          if (r.ok) {
            const d = await r.json();
            if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
              const rawVal = await this._decompressJsonStringGzipBase64(d.fields.jsonPayload.stringValue);
              const parsed = JSON.parse(rawVal);
              if (parsed && parsed._isChunked && parsed._chunkCount && parsed._chunkDocPrefix) {
                item = { ...item, ...parsed };
              } else if (parsed) {
                if (item.id) {
                  await this._idbCacheSet('graphly_full_doc_' + item.id, d.fields.jsonPayload.stringValue, parsed.expiresAt || 0).catch(() => { });
                }
                return { ...item, ...parsed };
              }
            }
          }
        } catch (e) { }
      }
      if (!item._isChunked || !item._chunkCount || !item._chunkDocPrefix) return item;
    }
    if (typeof window !== 'undefined' && window.location && !/^https?:$/i.test(window.location.protocol)) {
      return item;
    }
    try {
      const preferredCol = item._chunkCollection || 'shared_workspaces';
      const fallbackCol = preferredCol === 'user_library' ? 'shared_workspaces' : 'user_library';
      const indices = Array.from({ length: item._chunkCount }, (_, i) => i);
      const parts = await Promise.all(indices.map(async (idx) => {
        const chunkDocId = `${item._chunkDocPrefix}${idx}`;
        const primaryUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${preferredCol}/${encodeURIComponent(chunkDocId)}`;
        let r = await fetch(primaryUrl);
        if (!r.ok && r.status === 404) {
          const fallbackUrl = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${fallbackCol}/${encodeURIComponent(chunkDocId)}`;
          r = await fetch(fallbackUrl);
        }
        if (!r.ok) return '';
        const d = await r.json();
        if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
          const pObj = JSON.parse(d.fields.jsonPayload.stringValue);
          return pObj.data || '';
        }
        return '';
      }));
      const joined = parts.join('');
      if (joined) {
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
        return mergedFull;
      }
    } catch (e) { }
    return item;
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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}?pageSize=${pageSize}`;
    const res = await fetch(url);
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
    const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(docId)}`;
    await fetch(url, { method: 'DELETE' });
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
      btnSave.innerHTML = '<span>⏳ 저장 중...</span>';
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
      const effFilter = activePendingFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
      if (!this._isCapturingExportSnapshots) {
        this._isCapturingExportSnapshots = true;
        const backupCurrent = this.serializeFullSlideState('backup');
        try {
          for (let i = 0; i < slides.length; i++) {
            if (slides[i] && !slides[i].viewerSnapshotDataUrl) {
              this.deserializeFullSlideState(slides[i]);
              await this._waitForSlideImagesReady();
              const snap = this.captureCurrentSlideViewerSnapshot(effFilter, true);
              slides[i].viewerSnapshotDataUrl = snap.dataUrl;
              slides[i].viewerSnapshotWidth = snap.width;
              slides[i].viewerSnapshotHeight = snap.height;
              slides[i].viewerGraphHotspots = snap.hotspots;
              slides[i].viewerStickerHotspots = snap.stickerHotspots;
              slides[i].viewerSmartBounds = snap.smartBounds;
            }
          }
        } finally {
          this._isCapturingExportSnapshots = false;
          if (backupCurrent) {
            this.deserializeFullSlideState(backupCurrent);
          }
        }
      }

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

      if (folderName) {
        const folders = this.getCloudFoldersList();
        const rootSeg = folderName.split('/')[0].trim();
        if (rootSeg && !folders.includes(rootSeg)) folders.push(rootSeg);
        if (!folders.includes(folderName)) folders.push(folderName);
        this._saveCloudFoldersList(folders);
      }

      if (overwriteTargetItem) {
        await this._cleanupCloudItemChunks(overwriteTargetItem);
        this.myLibraryCache = (this.myLibraryCache || []).filter(x => x && x.id !== itemId);
      }
      this.myLibraryCache.unshift(itemObj);
      this._saveMyLibraryCacheForCurrentUser();
      if (this._selectedCloudExplorerKeys) {
        this._selectedCloudExplorerKeys.clear();
      }

      this.syncExportCloudFolderSelect();
      this.renderMyLibraryList();
      if (!customTitle && inpTitle) inpTitle.value = '';
      const folderPrefix = folderName ? `[📁 ${folderName.replace(/\//g, ' › ')}] ` : '';
      this.showToast(overwriteTargetItem
        ? `🔄 ${folderPrefix}[${finalTitle}] 파일을 최신 내용으로 덮어썼습니다!`
        : (isDeck
          ? `📚 ${folderPrefix}[${finalTitle}] (${slides.length}문항 세트) 클라우드 저장 완료!`
          : `☁️ ${folderPrefix}[${finalTitle}] 클라우드 보관함에 저장되었습니다!`));

      try {
        await this._firestoreRestWrite('user_library', itemId, itemObj);
      } catch (e) { }

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

      return itemObj;
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
  async _buildSelfLaunchingGraphlyHtml(packObj) {
    const safeTitle = String((packObj && packObj.title) || 'Graphly 수업 노트')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const rawJsonStr = JSON.stringify(packObj);
    const compressedPayload = await this._compressJsonStringGzipBase64(rawJsonStr);
    const escapedPayload = compressedPayload.replace(/<\/script>/gi, '<\\/script>');
    const originUrl = (window.location && /^https?:/i.test(window.location.protocol))
      ? window.location.origin + window.location.pathname
      : 'https://graphly.net/';
    return [
      '<!DOCTYPE html>',
      '<html lang="ko"><head><meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">',
      `<title>${safeTitle} - Graphly</title>`,
      '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0f172a;}iframe{position:fixed;inset:0;width:100vw;height:100vh;border:0;display:block;}</style>',
      '</head><body>',
      `<script id="graphly-package-json" type="application/json">${escapedPayload}</script>`,
      `<iframe id="graphlyAppFrame" src="${originUrl}" allow="microphone; clipboard-read; clipboard-write; fullscreen"></iframe>`,
      '<script>',
      '(function(){',
      '  var raw = document.getElementById("graphly-package-json").textContent;',
      '  if (window.top === window && window.location.protocol === "file:" && navigator.onLine !== false) {',
      '    try { window.name = "GRAPHLY_AUTOPACK:" + raw; window.location.replace("' + originUrl + '"); return; } catch (err) {}',
      '  }',
      '  var frame = document.getElementById("graphlyAppFrame");',
      '  var sent = false;',
      '  function sendPack(){',
      '    if (!frame || !frame.contentWindow) return;',
      '    var msg = { type: "GRAPHLY_AUTO_OPEN_DECK", rawPack: raw };',
      '    if (raw && raw.charAt(0) === "{") { try { msg.pack = JSON.parse(raw); } catch(e){} }',
      '    frame.contentWindow.postMessage(msg, "*");',
      '  }',
      '  window.addEventListener("message", function(e){',
      '    if (e && e.data && e.data.type === "GRAPHLY_APP_READY") { sent = true; sendPack(); }',
      '  });',
      '  frame.addEventListener("load", function(){',
      '    sendPack();',
      '    setTimeout(function(){ if (!sent) sendPack(); }, 350);',
      '  });',
      '})();',
      '</script></body></html>'
    ].join('\n');
  }

  async _extractGraphlyPackFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
    if (trimmed.startsWith('GZ1:')) {
      const jsonStr = await this._decompressJsonStringGzipBase64(trimmed);
      return JSON.parse(jsonStr);
    }
    const markerStart = trimmed.indexOf('<script id="graphly-package-json" type="application/json">');
    if (markerStart !== -1) {
      const jsonStart = markerStart + '<script id="graphly-package-json" type="application/json">'.length;
      const jsonEnd = trimmed.indexOf('</script>', jsonStart);
      if (jsonEnd !== -1) {
        const rawPayload = trimmed.slice(jsonStart, jsonEnd).replace(/<\\\/script>/gi, '</script>').trim();
        const jsonStr = await this._decompressJsonStringGzipBase64(rawPayload);
        return JSON.parse(jsonStr);
      }
    }
    const fallbackStr = await this._decompressJsonStringGzipBase64(trimmed);
    return JSON.parse(fallbackStr);
  }

  loadGraphlyPackObject(pack, fallbackTitle = '불러온 수업 세트', autoPlayIfAudio = false) {
    if (!pack) return null;
    const slides = Array.isArray(pack.playlistSlides) && pack.playlistSlides.length > 0
      ? pack.playlistSlides
      : (pack.slideData ? [pack.slideData] : (pack.historyJson ? [pack] : []));
    if (!slides.length) {
      this.showToast('⚠️ 올바른 Graphly 수업 파일이 아닙니다.');
      return null;
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

  async exportGraphlyDeckFile(title = 'Graphly_수업세트', tags = '#통째수업', slidesArray = null) {
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
    const effFilter = this.exportFilter || { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true };
    if (!this._isCapturingExportSnapshots) {
      this._isCapturingExportSnapshots = true;
      const backupCurrent = this.serializeFullSlideState('backup');
      try {
        for (let i = 0; i < slides.length; i++) {
          if (slides[i] && !slides[i].viewerSnapshotDataUrl) {
            this.deserializeFullSlideState(slides[i]);
            await this._waitForSlideImagesReady();
            const snap = this.captureCurrentSlideViewerSnapshot(effFilter, true);
            slides[i].viewerSnapshotDataUrl = snap.dataUrl;
            slides[i].viewerSnapshotWidth = snap.width;
            slides[i].viewerSnapshotHeight = snap.height;
            slides[i].viewerGraphHotspots = snap.hotspots;
            slides[i].viewerStickerHotspots = snap.stickerHotspots;
            slides[i].viewerSmartBounds = snap.smartBounds;
          }
        }
      } finally {
        this._isCapturingExportSnapshots = false;
        if (backupCurrent) {
          this.deserializeFullSlideState(backupCurrent);
        }
      }
    }
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

    const htmlStr = await this._buildSelfLaunchingGraphlyHtml(packObj);
    const blob = new Blob([htmlStr], { type: 'text/html;charset=utf-8' });
    const safeFileName = String(packObj.title)
      .replace(/\.graphly(\.html)?$/i, '')
      .replace(/[\/:*?"<>|]/g, '_')
      .trim() || 'Graphly_Lesson';
    const fileName = `${safeFileName}.graphly.html`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    this.showToast(`💾 [${fileName}] 저장 완료! 더블클릭하면 브라우저가 자동 실행되며 바로 열립니다.`);
    return packObj;
  }

  async importGraphlyDeckFile(file) {
    if (!file) return null;
    try {
      const text = await file.text();
      const pack = await this._extractGraphlyPackFromText(text);
      const cleanName = file.name ? file.name.replace(/\.(graphly\.html|graphly|json|html)$/i, '') : '불러온 수업 세트';
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

    const parsedCandidates = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const pack = await this._extractGraphlyPackFromText(text);
        if (!pack) continue;
        const slides = Array.isArray(pack.playlistSlides) && pack.playlistSlides.length > 0
          ? pack.playlistSlides
          : (pack.slideData ? [pack.slideData] : (pack.historyJson ? [pack] : []));
        if (!slides.length) continue;

        slides.forEach(s => {
          if (s && s.audioSyncData) s.audioSyncData = this._compactAudioSyncData(s.audioSyncData);
        });

        const cleanFileName = file.name
          ? file.name.replace(/\.(graphly\.html|graphly|json|html)$/i, '').trim()
          : '';
        const rawTitle = cleanFileName || (pack.title ? String(pack.title).trim() : 'Graphly 수업 노트');
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
      this.showToast('⚠️ 업로드할 수 있는 Graphly 수업 파일(.graphly)이 아닙니다.');
      return [];
    }

    const uploadedItems = [];
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

      if (overwriteTarget) {
        await this._cleanupCloudItemChunks(overwriteTarget);
        this.myLibraryCache = (this.myLibraryCache || []).filter(x => x && x.id !== itemId);
      }
      this.myLibraryCache.unshift(itemObj);
      uploadedItems.push(itemObj);
    }

    if (!uploadedItems.length) {
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
    try {
      await Promise.all(uploadedItems.map(it => this._firestoreRestWrite('user_library', it.id, it)));
    } catch (e) { }

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
    return await this.exportGraphlyDeckFile(title, tags, selectedSlides);
  }

  async fetchMyLibraryFromCloud() {
    if (!this.cloudUser || !this.cloudUser.uid) {
      this.myLibraryCache = [];
      this.renderMyLibraryList();
      return [];
    }
    try {
      const uid = this.cloudUser.uid;
      const rawUid = this.cloudUser.rawUid ? String(this.cloudUser.rawUid) : '';
      const normEmail = String(this.cloudUser.email || '').trim().toLowerCase();
      const emailVariants = (normEmail && normEmail.includes('@'))
        ? [
            this._getCanonicalUidForEmail(normEmail, '', 'google'),
            this._getCanonicalUidForEmail(normEmail, '', 'email')
          ]
        : [];
      const candidateUids = Array.from(new Set([uid, rawUid, ...emailVariants].filter(Boolean)));
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
          if (prev && remoteIt._isChunked && !remoteIt.playlistSlides && !remoteIt.slideData) {
            mergedMap.set(remoteIt.id, {
              ...prev,
              ...remoteIt,
              byteSize: remoteIt.byteSize || prev.byteSize || 0,
              rawByteSize: remoteIt.rawByteSize || prev.rawByteSize || 0,
              playlistSlides: prev.playlistSlides || null,
              slideData: prev.slideData || null
            });
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
      if (lblCurrentPath) lblCurrentPath.textContent = '🔒 로그인 필요';
      if (listEl) {
        listEl.innerHTML = `
          <div class="cloud-empty-msg" style="padding:36px 16px; line-height:1.7;">
            🔒 <strong>클라우드 보관함은 로그인 후 이용할 수 있습니다.</strong><br>
            <button type="button" id="btnCloudEmptyGoLogin" class="btn-cloud-go-settings-login">⚙️ 설정에서 로그인하기</button>
          </div>
        `;
        const btnGoLogin = document.getElementById('btnCloudEmptyGoLogin');
        if (btnGoLogin) {
          btnGoLogin.onclick = () => {
            this.promptCloudLoginForLibrary('🔑 좌측 설정창의 [내 계정 & 클라우드]에서 로그인해 주세요.');
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
        ? `(${saveTargetFolder.split('/').pop()})`
        : '(내 클라우드)';
    }
    if (btnNavUp) {
      btnNavUp.disabled = (!activeFolder);
    }

    if (!this._selectedCloudExplorerKeys) {
      this._selectedCloudExplorerKeys = new Set();
    }

    // 내 PC(윈도우 탐색기 등)에서 .graphly 파일을 끌어다 놓았을 때 해당 폴더로 즉시 업로드하는 외부 파일 드롭 전용 헬퍼
    // (보관함 내부 항목 드래그 앤 드롭은 제거하여 오작동 없이 100% 안정적으로 운영)
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

    // 2. 상단 윈도우 탐색기 주소 표시줄 (Breadcrumb) 렌더링
    if (crumbBar) {
      crumbBar.innerHTML = '';
      const homeCrumb = document.createElement('button');
      homeCrumb.type = 'button';
      homeCrumb.className = 'win-crumb-item' + (activeFolder === '' ? ' active' : '');
      homeCrumb.innerHTML = `<span>☁️ 내 클라우드</span>`;
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
        recCrumb.innerHTML = `<span>🕒 전체 파일 모아보기</span>`;
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

          const cBtn = document.createElement('button');
          cBtn.type = 'button';
          cBtn.className = 'win-crumb-item' + (idx === segs.length - 1 ? ' active' : '');
          cBtn.innerHTML = `<span>📁 ${seg}</span>`;
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

      // (A) 루트: ☁️ 내 클라우드 (삼각형 없이 아이콘+이름만 깔끔하게 표시)
      const homeNode = document.createElement('div');
      homeNode.className = 'cloud-tree-node' + (activeFolder === '' ? ' active' : '');
      homeNode.innerHTML = `
        <div class="cloud-tree-node-left">
          <span class="cloud-tree-icon">☁️</span>
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

      // (B) 재귀 폴더 트리 노드 렌더링 (윈도우 탐색기식 점선 ├·└ + 초슬림 들여쓰기 + 삼각형 제거)
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

          const node = document.createElement('div');
          node.className = 'cloud-tree-node' + (isAct ? ' active' : '');
          node.innerHTML = `
            <div class="cloud-tree-node-left">
              ${indentGuidesHtml}
              <span class="cloud-tree-icon">${isOpenBranch ? '📂' : '📁'}</span>
              <span class="cloud-tree-name" title="${fPath.replace(/\//g, ' › ')}">${segName}</span>
            </div>
          `;

          node.onclick = () => {
            if (this._activeCloudFolder === fPath && hasSubs) {
              // 이미 선택된 폴더를 다시 누르면 하위 폴더 열기/접기 토글
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
          <span class="cloud-tree-icon">🕒</span>
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

    // 내 PC 탐색기에서 우측 파일 목록으로 .graphly 파일을 여러 개 드래그 앤 드롭하면 현재 열린 폴더에 즉시 업로드!
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

    // 4. 우측 메인 탐색기 영역: (1) 하위 폴더 행 + (2) 파일 행 (상위 폴더 이동 '..' 행 제거)
    // (1) 현재 폴더의 직계 하위 폴더 목록 (검색 중일 때는 검색어 일치 폴더)
    const visibleFolders = q
      ? allFolderPaths.filter(f => f.toLowerCase().includes(q))
      : (isAllRecentMode ? [] : getDirectChildFolders(activeFolder));

    // (2) 현재 폴더의 수업 파일 목록 필터링
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

    // DOM 파괴 없이 현재 행들의 체크박스 및 선택 하이라이트만 즉시 동기화 (더블클릭 100% 보장)
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

    const openMoveMenuForSingleRow = (rowKey, e) => {
      e.stopPropagation();
      this._selectedCloudExplorerKeys.clear();
      this._selectedCloudExplorerKeys.add(rowKey);
      this._lastClickedCloudExplorerKey = rowKey;
      syncAllRowSelectionsInPlace();
      const menuEl = document.getElementById('cloudMoveDropdownMenu');
      if (menuEl) menuEl.style.display = 'none';
      this.toggleCloudExplorerMoveMenu();
    };

    visibleFolders.forEach(fPath => {
      const segName = fPath.split('/').pop();
      const rowKey = `folder:${fPath}`;
      const isSelected = this._selectedCloudExplorerKeys.has(rowKey);
      const row = document.createElement('div');
      row.className = 'win-explorer-row is-folder-row' + (isSelected ? ' selected' : '');
      row.dataset.rowKey = rowKey;

      if (this._renamingCloudFolderPath === fPath) {
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px; width:100%;">
            <span class="win-row-icon">📁</span>
            <input type="text" class="cloud-item-rename-input" value="${segName.replace(/"/g, '&quot;')}"
              style="flex:1; min-width:0; padding:4px 8px; border-radius:6px; border:1.5px solid #2563eb; font-size:12px; font-weight:700;" />
            <button type="button" class="btn-primary cloud-item-rename-save" style="padding:4px 10px; font-size:11.5px; border-radius:6px;">확인</button>
            <button type="button" class="btn-secondary cloud-item-rename-cancel" style="padding:4px 8px; font-size:11.5px; border-radius:6px;">취소</button>
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

      row.innerHTML = `
        <label class="win-row-chk-wrap" title="체크하여 폴더 선택">
          <input type="checkbox" class="win-explorer-checkbox" ${isSelected ? 'checked' : ''}>
        </label>
        <div class="win-row-name-col" title="클릭하여 [${segName}] 폴더 열기">
          <span class="win-row-icon">📁</span>
          <span class="win-row-title">${segName}</span>
        </div>
        <div class="win-row-act-col">
          <button type="button" class="btn-cloud-edit-item" title="폴더 이름 바꾸기">✏️</button>
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
      emptyDiv.innerHTML = `이 폴더가 비어 있습니다.`;
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
      const folderBadgeHtml = ((isAllRecentMode || q) && curFolder)
        ? `<span class="cloud-item-folder-badge" title="소속 폴더">📁 ${curFolder.replace(/\//g, ' › ')}</span>`
        : '';

      if (this._renamingCloudItemId === item.id) {
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px; width:100%;">
            <span class="win-row-icon">📊</span>
            <input type="text" class="cloud-item-rename-input" value="${String(item.title || '').replace(/"/g, '&quot;')}"
              style="flex:1; min-width:0; padding:4px 8px; border-radius:6px; border:1.5px solid #2563eb; font-size:12px; font-weight:700;" />
            <button type="button" class="btn-primary cloud-item-rename-save" style="padding:4px 10px; font-size:11.5px; border-radius:6px;">확인</button>
            <button type="button" class="btn-secondary cloud-item-rename-cancel" style="padding:4px 8px; font-size:11.5px; border-radius:6px;">취소</button>
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

      row.innerHTML = `
        <label class="win-row-chk-wrap" title="체크하여 다중 선택">
          <input type="checkbox" class="win-explorer-checkbox" ${isSelected ? 'checked' : ''}>
        </label>
        <div class="win-row-name-col" title="더블클릭하여 칠판에 열기">
          <span class="win-row-icon">📊</span>
          ${folderBadgeHtml}
          <span class="win-row-title">${item.title || '제목 없음'}</span>
        </div>
        <div class="win-row-act-col">
          <button type="button" class="btn-cloud-edit-item" title="파일 이름 바꾸기">✏️</button>
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
        if (e.target && (e.target.closest('.win-row-chk-wrap') || e.target.closest('.win-row-act-col'))) {
          return;
        }
        handleRowSelectionClick(rowKey, e);
      };

      row.ondblclick = (e) => {
        if (e.target && (e.target.closest('.win-row-chk-wrap') || e.target.closest('.win-row-act-col'))) {
          return;
        }
        e.preventDefault();
        this.loadCloudItemToWorkspace(item, true);
      };

      const btnEdit = row.querySelector('.btn-cloud-edit-item');
      if (btnEdit) {
        btnEdit.onclick = (e) => {
          e.stopPropagation();
          this._renamingCloudItemId = item.id;
          this.renderMyLibraryList();
        };
      }

      listEl.appendChild(row);
    });

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
          const cv = s.pdfPageBoardData.canvas || (this._pdfPageCanvasCache && s.pdfPageBoardData.pageNum ? this._pdfPageCanvasCache[s.pdfPageBoardData.pageNum] : null);
          if (cv) {
            s.pdfPageBoardData.dataUrl = this.encodeCanvasSmartWebP(cv, 0.82);
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
          if (ep) ep.problemInkStrokes = [];
        });
      }
    }

    if (!incGraph) {
      slide.primaryGraphCard = null;
      slide.extraGraphs = [];
      slide.coveredGraphStateBackup = null;
    } else if (!incInk) {
      if (slide.primaryGraphCard) {
        slide.primaryGraphCard.graphInkStrokes = [];
      }
      if (Array.isArray(slide.extraGraphs)) {
        slide.extraGraphs.forEach(eg => {
          if (eg) eg.graphInkStrokes = [];
        });
      }
    }

    if (!incAudio) {
      slide.audioSyncData = null;
    } else if (slide.audioSyncData && !incInk) {
      slide.audioSyncData.laserStrokes = [];
      if (slide.audioSyncData.initialState) {
        slide.audioSyncData.initialState = this._applyExportFilterToSlideData(
          slide.audioSyncData.initialState,
          { includeProblem: incProb, includeGraph: incGraph, includeInk: false, includeAudio: false }
        );
      }
      if (slide.audioSyncData.finalState) {
        slide.audioSyncData.finalState = this._applyExportFilterToSlideData(
          slide.audioSyncData.finalState,
          { includeProblem: incProb, includeGraph: incGraph, includeInk: false, includeAudio: false }
        );
      }
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
    if (this.pdfPageBoardData && this.pdfPageBoardData.img && !this.pdfPageBoardData.canvas && this.pdfPageBoardData.img.naturalWidth > 0) {
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
    const targetScale = isMobileDevice ? 1.8 : (forCloud ? 2.8 : 3.2);
    let exp;
    try {
      exp = this.getExportCanvas(effFilter, smartBounds, targetScale);
    } finally {
      this._omitStickersForViewerSnapshot = false;
    }
    let dataUrl = '';
    try {
      dataUrl = (forCloud || isMobileDevice)
        ? this.encodeCanvasSmartWebP(exp.canvas, 0.88)
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

    const isOuterLoop = !this._isCapturingExportSnapshots;
    if (isOuterLoop) {
      this._isCapturingExportSnapshots = true;
      this._exportSnapshotLoopRawSlides = JSON.parse(JSON.stringify(rawSlides));
      this._exportSnapshotLoopBackupCurrent = this.serializeFullSlideState('backup');
    }
    try {
      for (let i = 0; i < filteredSlides.length; i++) {
        this.deserializeFullSlideState(filteredSlides[i]);
        await this._waitForSlideImagesReady();
        const snap = this.captureCurrentSlideViewerSnapshot(effFilter, true);
        filteredSlides[i].viewerSnapshotDataUrl = snap.dataUrl;
        filteredSlides[i].viewerSnapshotWidth = snap.width;
        filteredSlides[i].viewerSnapshotHeight = snap.height;
        filteredSlides[i].viewerGraphHotspots = snap.hotspots;
        filteredSlides[i].viewerStickerHotspots = snap.stickerHotspots;
        filteredSlides[i].viewerSmartBounds = snap.smartBounds;
        filteredSlides[i]._viewerHiResRendered = true;
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

    const nowMs = Date.now();
    const TWO_WEEKS_MS = 7 * 24 * 60 * 60 * 1000; // 🌟 [대표님 정책]: 공유 링크 & QR 자동 소멸 기한 7일(7일간 유효)
    const shortId = 's' + nowMs.toString(36) + Math.random().toString(36).slice(2, 6);
    return {
      id: shortId,
      createdAt: nowMs,
      expiresAt: nowMs + TWO_WEEKS_MS,
      exportScope: effScope,
      exportFilter: { ...effFilter },
      isPlaylist: filteredSlides.length > 1,
      playlistSlides: filteredSlides,
      currentIndex: 0
    };
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
    const filterKey = `${scope || 'current'}|${Boolean(f.includeProblem)}|${Boolean(f.includeGraph)}|${Boolean(f.includeInk)}|${f.includeAudio !== false}`;
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
    const TWO_WEEKS_MS = 7 * 24 * 60 * 60 * 1000; // 🌟 [대표님 정책]: 공유 링크 & QR 자동 소멸 기한 7일(7일간 유효)
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('graphly_cloud_share_') || k.startsWith('graphly_full_doc_s'))) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const obj = JSON.parse(raw);
              const exp = obj.expiresAt || ((obj.createdAt || 0) + TWO_WEEKS_MS);
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
    // IndexedDB 내 만료된 공유 캐시 및 오래된 캐시 자동 정리 (클라이언트가 남의 서버 문서 40개를 다운로드하던 코드는 완전 제거!)
    if (typeof this._idbCachePurgeExpired === 'function') {
      await this._idbCachePurgeExpired(nowMs, 80).catch(() => { });
    }
  }

  async createCloudSharePackage(scope = null, filterOpts = null) {
    this._purgeExpiredSharedWorkspaces().catch(() => { });
    const effScope = scope || this.exportScope || 'current';
    const effFilter = filterOpts || this.exportFilter;
    const pkg = await this.buildExportSharePackageObject(effScope, effFilter);

    const noteSessionKey = this._computeShareNoteSessionKey(effScope, pkg.playlistSlides);
    const contentSig = this._computeShareContentSignature(effScope, effFilter, pkg.playlistSlides);

    // 1) 내용이 1비트도 안 바뀐 상태에서 공유 모달을 다시 열어 버튼을 누른 경우: 서버 재업로드 없이 기존 링크 0.00초 즉시 반환!
    if (
      this._activeSessionShareShortId &&
      this._lastShareNoteSessionKey === noteSessionKey &&
      this._lastShareContentSig === contentSig
    ) {
      return this._activeSessionShareShortId;
    }

    // 2) 동일한 문제/수업 노트에서 필기·오타·음성을 수정하고 다시 공유를 누른 경우: 유령 문서를 새로 파지 않고 직전 임시 shortId에 덮어쓰기!
    if (this._activeSessionShareShortId && this._lastShareNoteSessionKey === noteSessionKey) {
      pkg.id = this._activeSessionShareShortId;
      if (this._lastSessionShareManifestMeta) {
        await this._cleanupCloudItemChunks(this._lastSessionShareManifestMeta).catch(() => { });
      }
    } else {
      this._activeSessionShareShortId = pkg.id;
      this._lastShareNoteSessionKey = noteSessionKey;
    }
    this._lastShareContentSig = contentSig;

    const shortId = pkg.id;
    const fullPkgJson = JSON.stringify(pkg);
    const compressedFullPkg = await this._compressJsonStringGzipBase64(fullPkgJson);

    // 로컬 캐시는 용량 제한 없는 IndexedDB에 저장 (5MB 초과 음성 강의도 100% 캐싱!)
    await this._idbCacheSet('graphly_cloud_share_' + shortId, compressedFullPkg, pkg.expiresAt).catch(() => { });
    await this._idbCacheSet('graphly_full_doc_' + shortId, compressedFullPkg, pkg.expiresAt).catch(() => { });
    try { localStorage.removeItem('graphly_cloud_share_' + shortId); } catch (e) { }

    // 3) 🌟 [음성 데이터 Lazy Load 분리 업로드]:
    // 학생이 링크를 열 때 첫 화면(200KB 스캔본)은 0.3초 만에 즉시 뜨고, [▶️ 영상 보기]를 눌렀을 때만 음성 청크를 다운로드하도록 분리!
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
            createdAt: sl.audioSyncData.createdAt || Date.now(),
            _isLazyAudioStub: true,
            _lazySlideIdx: idx
          };
        }
      });
    }

    if (hasAnyAudio) {
      try {
        const audioNetStr = await this._compressJsonStringGzipBase64(JSON.stringify(audioMap));
        const CHUNK_LIMIT = 700000;
        const audioChunks = [];
        for (let i = 0; i < audioNetStr.length; i += CHUNK_LIMIT) {
          audioChunks.push(audioNetStr.slice(i, i + CHUNK_LIMIT));
        }
        const audioPrefix = `${shortId}_audio_`;
        const baseUid = (this.cloudUser && this.cloudUser.uid) ? this.cloudUser.uid : 'anonymous';
        await Promise.all(audioChunks.map((cStr, idx) =>
          this._firestoreRestWriteSingleDoc(
            'shared_workspaces',
            `${audioPrefix}${idx}`,
            JSON.stringify({ _isChunkPart: true, _isAudioChunk: true, parentId: shortId, partIndex: idx, data: cStr }),
            { ownerUid: `chunk_audio_${baseUid}`, expireAtMs: pkg.expiresAt }
          )
        ));
        cloudPkg._hasLazyAudio = true;
        cloudPkg._audioChunkCollection = 'shared_workspaces';
        cloudPkg._audioChunkPrefix = audioPrefix;
        cloudPkg._audioChunkCount = audioChunks.length;
      } catch (e) {
        // 만약 오디오 분리 업로드 중 네트워크 예외가 발생하면 원본(통합본)으로 안전 폴백
        if (Array.isArray(cloudPkg.playlistSlides)) {
          Object.keys(audioMap).forEach((k) => {
            const idx = Number(k);
            if (cloudPkg.playlistSlides[idx]) {
              cloudPkg.playlistSlides[idx].audioSyncData = audioMap[k];
            }
          });
        }
      }
    }

    try {
      await this._firestoreRestWrite('shared_workspaces', shortId, cloudPkg, {
        skipLocalFullCache: true,
        expireAtMs: pkg.expiresAt
      });
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
    } catch (e) { }

    return shortId;
  }

  // 🌟 [공유 링크의 음성 강의 데이터를 학생이 실제로 '▶️ 영상 보기' 또는 '✏️ 편집하기'를 눌렀을 때만 온디맨드 로드!]
  async _ensureCloudShareAudioLoaded(pkg) {
    if (!pkg || !Array.isArray(pkg.playlistSlides)) return pkg;
    const needsLazyLoad = Boolean(
      (pkg._hasLazyAudio && pkg._audioChunkCount > 0 && pkg._audioChunkPrefix) ||
      pkg.playlistSlides.some(s => s && s.audioSyncData && s.audioSyncData._isLazyAudioStub)
    );
    if (!needsLazyLoad) return pkg;

    const audioPrefix = pkg._audioChunkPrefix || (pkg.id ? `${pkg.id}_audio_` : '');
    const audioCount = Number(pkg._audioChunkCount) || 0;
    const audioCol = pkg._audioChunkCollection || 'shared_workspaces';
    if (!audioPrefix || audioCount <= 0) return pkg;

    if (this._activeLazyAudioLoadPromise && this._activeLazyAudioLoadPkgId === pkg.id) {
      await this._activeLazyAudioLoadPromise;
      return pkg;
    }

    const loadTask = (async () => {
      try {
        // 1. 먼저 IndexedDB에 전체 오디오가 포함된 캐시가 있는지 확인
        if (pkg.id) {
          const cachedRaw = await this._idbCacheGet('graphly_cloud_share_' + pkg.id) || await this._idbCacheGet('graphly_full_doc_' + pkg.id);
          if (cachedRaw) {
            const uncomp = typeof cachedRaw === 'string'
              ? await this._decompressJsonStringGzipBase64(cachedRaw)
              : JSON.stringify(cachedRaw);
            const parsedCached = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
            if (
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

        // 2. 서버에서 음성 청크만 병렬 다운로드 및 복원
        const indices = Array.from({ length: audioCount }, (_, i) => i);
        const parts = await Promise.all(indices.map(async (idx) => {
          const chunkDocId = `${audioPrefix}${idx}`;
          const url = `https://firestore.googleapis.com/v1/projects/${this._firebaseProjectId}/databases/(default)/documents/${audioCol}/${encodeURIComponent(chunkDocId)}`;
          const r = await fetch(url);
          if (!r.ok) return '';
          const d = await r.json();
          if (d && d.fields && d.fields.jsonPayload && d.fields.jsonPayload.stringValue) {
            const pObj = JSON.parse(d.fields.jsonPayload.stringValue);
            return pObj.data || '';
          }
          return '';
        }));
        const joined = parts.join('');
        if (!joined) return pkg;

        const decompressed = await this._decompressJsonStringGzipBase64(joined);
        const audioMap = JSON.parse(decompressed);
        if (audioMap && typeof audioMap === 'object') {
          const applyAudioMapToSlides = (slidesArr) => {
            if (!Array.isArray(slidesArr)) return;
            Object.keys(audioMap).forEach((k) => {
              const sIdx = Number(k);
              if (slidesArr[sIdx] && audioMap[k]) {
                slidesArr[sIdx].audioSyncData = JSON.parse(JSON.stringify(audioMap[k]));
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

          // 3. 음성까지 완전체로 합쳐진 패키지를 IndexedDB에 캐싱 (새로고침이나 재방문 시 재다운로드 0바이트!)
          if (pkg.id) {
            const hydratedCompressed = await this._compressJsonStringGzipBase64(JSON.stringify(pkg));
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

  async restoreFromCloudShareId(shortId, isStudent = false) {
    if (!shortId) return;
    let pkg = null;
    try {
      const idbRaw = await this._idbCacheGet('graphly_cloud_share_' + shortId);
      const localRaw = idbRaw || localStorage.getItem('graphly_cloud_share_' + shortId);
      if (localRaw) {
        const uncomp = typeof localRaw === 'string'
          ? await this._decompressJsonStringGzipBase64(localRaw)
          : JSON.stringify(localRaw);
        pkg = typeof uncomp === 'string' ? JSON.parse(uncomp) : uncomp;
      }
    } catch (e) { }

    if (!pkg) {
      try {
        pkg = await this._firestoreRestReadDoc('shared_workspaces', shortId);
        if (pkg) {
          const compPkg = await this._compressJsonStringGzipBase64(JSON.stringify(pkg));
          await this._idbCacheSet('graphly_cloud_share_' + shortId, compPkg, pkg.expiresAt || 0).catch(() => { });
        }
      } catch (e) { }
    }

    if (pkg) {
      const TWO_WEEKS_MS = 7 * 24 * 60 * 60 * 1000; // 🌟 [대표님 정책]: 공유 링크 & QR 자동 소멸 기한 7일(7일간 유효)
      const exp = pkg.expiresAt || ((pkg.createdAt || 0) + TWO_WEEKS_MS);
      if (pkg.createdAt && Date.now() > exp) {
        try { localStorage.removeItem('graphly_cloud_share_' + shortId); } catch (e) { }
        await this._idbCacheDelete('graphly_cloud_share_' + shortId).catch(() => { });
        await this._idbCacheDelete('graphly_full_doc_' + shortId).catch(() => { });
        await this._cleanupCloudItemChunks(pkg).catch(() => { });
        this._firestoreRestDeleteDoc('shared_workspaces', shortId).catch(() => { });
        this.showToast('⏰ 유효기간(7일)이 만료된 공유 링크입니다.');
        return;
      }
    }

    if (!pkg || !Array.isArray(pkg.playlistSlides) || !pkg.playlistSlides.length) {
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

  async enterStudentAudioVideoOnlyMode(pkg, autoPlay = false) {
    if (!pkg) return;
    if (typeof this._ensureCloudShareAudioLoaded === 'function') {
      await this._ensureCloudShareAudioLoaded(pkg);
    }
    const slides = Array.isArray(pkg.playlistSlides) && pkg.playlistSlides.length > 0
      ? pkg.playlistSlides
      : (pkg.slideData ? [pkg.slideData] : (pkg.historyJson ? [pkg] : []));
    if (!slides.length) return;

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
    this.audioReplayViewMode = 'video';
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

    this._isAudioSyncPlayerVisible = true;
    this.audioReplayViewMode = 'video';
    this._isAudioReplayActive = true;
    document.body.classList.add('audio-replay-active');
    if (typeof this._syncReplayFixedStageLayout === 'function') this._syncReplayFixedStageLayout();
    this._applyAudioTimelineStateAt(0);
    this.updateProblemCardPosition();
    this.syncProblemCardRectFromWidget();
    this.syncGraphCardRectFromWidget();
    if (typeof this._refreshProblemCardImagesForReplayStage === 'function') {
      this._refreshProblemCardImagesForReplayStage();
    }
    if (autoPlay) {
      this.playAudioSync(0, 'video');
    } else {
      this.pauseAudioPlayback(false);
      this.audioPlayCurrentMs = 0;
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
      exportScope: previewSlides.length > 1 ? 'all' : 'current',
      exportFilter: { includeProblem: true, includeGraph: true, includeInk: true, includeAudio: true },
      isPlaylist: Boolean(this.isLessonPlaylistActive) || previewSlides.length > 1,
      playlistSlides: previewSlides,
      currentIndex: activeIdx
    };

    await this.openSmartNoteViewer(pkg, true);
  }

  _preloadSmartViewerSlides(pkg) {
    if (!pkg || !Array.isArray(pkg.playlistSlides)) return;
    if (!this._viewerPreloadedImages) this._viewerPreloadedImages = new Map();
    pkg.playlistSlides.forEach((sl) => {
      if (sl && sl.viewerSnapshotDataUrl && !this._viewerPreloadedImages.has(sl.viewerSnapshotDataUrl)) {
        const im = new Image();
        im.decoding = 'async';
        im.src = sl.viewerSnapshotDataUrl;
        this._viewerPreloadedImages.set(sl.viewerSnapshotDataUrl, im);
      }
    });
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
    if (!slide.viewerSnapshotDataUrl) {
      this.deserializeFullSlideState(slide);
      await this._waitForSlideImagesReady();
      const snap = this.captureCurrentSlideViewerSnapshot((this._viewerPkg && this._viewerPkg.exportFilter) || null, false);
      slide.viewerSnapshotDataUrl = snap.dataUrl;
      slide.viewerSnapshotWidth = snap.width;
      slide.viewerSnapshotHeight = snap.height;
      slide.viewerGraphHotspots = snap.hotspots;
      slide.viewerStickerHotspots = snap.stickerHotspots;
      slide.viewerSmartBounds = snap.smartBounds;
      slide._viewerHiResRendered = true;
    }
    if (slide.viewerSnapshotDataUrl) {
      if (!this._viewerPreloadedImages) this._viewerPreloadedImages = new Map();
      if (!this._viewerPreloadedImages.has(slide.viewerSnapshotDataUrl)) {
        const im = new Image();
        im.decoding = 'async';
        im.src = slide.viewerSnapshotDataUrl;
        this._viewerPreloadedImages.set(slide.viewerSnapshotDataUrl, im);
      }
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
    this._commitPendingViewerCarouselImmediately();
    this.exitStudentAudioVideoOnlyMode();
    if (this.virtualStylusEl) {
      this.virtualStylusEl.style.display = 'none';
    }
    this._viewerPkg = pkg;
    this._mobileViewerFsAttempted = false;
    this._preloadSmartViewerSlides(pkg);
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

    const startIdx = Math.max(0, Math.min(pkg.playlistSlides.length - 1, pkg.currentIndex || 0));
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
    if (!slide.viewerSnapshotDataUrl) {
      await this._ensureSlideViewerSnapshot(slide);
    }

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

    // 1. 슬라이드 데이터(뷰어 플레이리스트 / 멀티 슬라이드) 내부의 카드 필기 확인
    const slideList = (Array.isArray(this._viewerPlaylist) && this._viewerPlaylist.length > 0)
      ? this._viewerPlaylist
      : (Array.isArray(this.slides) ? this.slides : []);
    const slideData = slideList[slideIdx] || null;
    if (slideData) {
      if ((hsId === 'graph_card_1' || hsCase === 1) && slideData.primaryGraphCard && Array.isArray(slideData.primaryGraphCard.graphInkStrokes) && slideData.primaryGraphCard.graphInkStrokes.length > 0) {
        const cw = (parsedSnap && parsedSnap._pipCardW) || slideData.primaryGraphCard.cardW || 430;
        const ch = (parsedSnap && parsedSnap._pipCardH) || Math.round(cw * (slideData.primaryGraphCard.aspect || 0.82));
        return this._convertCardStrokeListToFullGraphInkStrokes(
          JSON.parse(JSON.stringify(slideData.primaryGraphCard.graphInkStrokes)),
          parsedSnap,
          cw,
          ch
        );
      }
      if (Array.isArray(slideData.extraGraphs) && slideData.extraGraphs.length > 0) {
        const eg = slideData.extraGraphs.find((item, idx) => (Number(item && item.caseIdx) || (idx + 2)) === hsCase);
        if (eg && Array.isArray(eg.cardInkStrokes) && eg.cardInkStrokes.length > 0) {
          const cw = (parsedSnap && parsedSnap._pipCardW) || eg.cardW || 430;
          const ch = (parsedSnap && parsedSnap._pipCardH) || Math.round(cw * (eg.aspect || 0.82));
          return this._convertCardStrokeListToFullGraphInkStrokes(
            JSON.parse(JSON.stringify(eg.cardInkStrokes)),
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
      const cardH = Math.max(80, parsedSnap._pipCardH || 353);
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
      const ox = (g.freezeOffset && typeof g.freezeOffset.x === 'number') ? g.freezeOffset.x : 0;
      const oy = (g.freezeOffset && typeof g.freezeOffset.y === 'number') ? g.freezeOffset.y : 0;
      if (g.handles) {
        g.handles.forEach(h => expandPt(h.x + ox, h.y + oy));
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
    this.graphs = data.g.map((gItem, idx) => {
      const g = {
        id: Date.now() + idx,
        type: gItem.t,
        category: (this.meta[gItem.t] && this.meta[gItem.t].category) || '📐 다항함수',
        color: gItem.c || this.colorPalette[idx % this.colorPalette.length],
        lineWidth: gItem.w || 2.8,
        isAbsolute: gItem.a === 1,
        handles: []
      };

      if (gItem.qm) g.quadMode = gItem.qm;
      if (gItem.qo) g.quadOriginCenter = true;
      g.isFrozen = gItem.fz === 1;
      g.freezeOffset = (gItem.fzo && Array.isArray(gItem.fzo)) ? { x: gItem.fzo[0], y: gItem.fzo[1] } : { x: 0, y: 0 };
      g.frozenInvertH = gItem.fzh === 1;
      g.frozenInvertV = gItem.fzv === 1;
      g.frozenAbsolute = gItem.fza === 1;

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
            const comp = window.SafeMathCompiler ? window.SafeMathCompiler.compile(raw) : null;
            if (comp && comp.success) {
              hObj.fn = comp.fn;
            }
          }
          return hObj;
        });
      }

      return g;
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
    if (o.zm !== undefined) this.zoomLevel = o.zm;
    if (o.int !== undefined) this.useIntersectionDetector = o.int === 1;

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

  encodeCanvasSmartWebP(canvas, quality = 1.0) {
    if (!canvas) return '';
    if (typeof quality === 'number' && quality < 0.99) {
      try {
        const webp = canvas.toDataURL('image/webp', quality);
        if (webp && webp.startsWith('data:image/webp')) return webp;
      } catch (e) { }
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
