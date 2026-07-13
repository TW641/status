(function() {
  // 🛡️ 單例模式防護 (Singleton Guard)：防止 SPA 路由切換時引發腳本重複執行與事件重複綁定，徹底杜絕記憶體洩漏 (Memory Leak)
  if (window.__jsDelivrScriptLoaded) return;
  window.__jsDelivrScriptLoaded = true;

  console.log("🚀 jsDelivr 路由轉換、API 速率防護、A11y 語意重構與 CDN 快取強制清除腳本已啟動！");

  // 擷取網址列的快取無效化參數 (Cache Buster)
  const urlParams = new URLSearchParams(window.location.search);
  const cacheBuster = urlParams.get('t');

  // 核心邏輯：將舊版 /status/master/ 替換為支援 jsDelivr CDN 的 /status@master/ 格式
  const fix = url => typeof url === 'string' ? url.replace('/status/master/', '/status@master/') : url;

  // 建立 Set 集合，用於記錄需執行 CDN 快取清洗 (Purge) 的資源網址，利用 Set 特性自動排除重複網址
  const fetchTargets = new Set();
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/history/summary.json');
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/cache-interceptor.js');

  // 🚀 [新增] 建立高效能 IntersectionObserver：專門攔截與延遲載入 (Lazy Load) 巨量 CSS 背景圖
  const bgObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.dataset.lazyBg) {
          // 當元素即將進入視窗，將隱藏的 URL 塞回 CSS 變數中，解鎖並觸發圖片下載
          el.style.setProperty('--background', el.dataset.lazyBg);
          el.removeAttribute('data-lazy-bg');
          observer.unobserve(el);
        }
      }
    });
  }, { rootMargin: '200px 0px' }); // 提早 200px 預先載入，確保滑動體驗平滑無縫隙

  // 1. 攔截並代理瀏覽器原生 fetch API (Network Proxy)
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    let reqUrl = '';
    let isRequestObject = false;

    // 嚴謹解析傳入的參數型態，涵蓋 String、URL 物件與 Request 物件
    if (typeof args[0] === 'string') {
      reqUrl = args[0];
    } else if (args[0] instanceof URL) {
      reqUrl = args[0].toString();
    } else if (args[0] instanceof Request) {
      reqUrl = args[0].url;
      isRequestObject = true;
    } else {
      // 遇到未知型態，安全退回原生行為
      return origFetch.apply(this, args);
    }

    // 🛡️ API 請求配額限制 (Rate Limit) 防禦：攔截高頻率的 GitHub API 請求，避免消耗 Token 額度
    if (reqUrl.includes('api.github.com/repos/TW641/status/issues') || 
        reqUrl.includes('api.github.com/repos/TW641/status/commits')) {
      console.warn('🛡️ 已攔截 GitHub API 請求並模擬 (Mock) 為空陣列，防止消耗配額:', reqUrl);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    reqUrl = fix(reqUrl); 

    if (reqUrl.includes('cdn.jsdelivr.net')) {
      fetchTargets.add(reqUrl.split('?')[0]); 
      if (cacheBuster) {
        reqUrl += (reqUrl.includes('?') ? '&' : '?') + 't=' + cacheBuster;
      }
    }

    // 重構攔截後的請求參數 (使用舊版穩定寫法，確保 100% 不引發相容性問題)
    if (isRequestObject) {
      args[0] = new Request(reqUrl, args[0]);
    } else {
      args[0] = reqUrl;
    }
    
    try {
      const response = await origFetch.apply(this, args);
      // 容錯機制 (Fallback)：若 GitHub API 發生 403 或 404 等異常，自動攔截並 Mock 為 200 狀態碼，避免前端 Svelte 發生畫面白屏 (White Screen of Death)
      if (!response.ok && reqUrl.includes('api.github.com')) {
        console.error(`⚠️ GitHub API 回傳錯誤 (${response.status})，已自動攔截並模擬為 200 狀態碼以維持前端穩定。`);
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return response;
    } catch (error) {
      console.error('🌐 網路請求發生例外錯誤 (Exception):', error);
      throw error;
    }
  };

  // 🛠️ 無障礙網頁 (A11y) 修正：將錯誤的 h4 動態重構為標準的 h3 標籤，解決 Lighthouse 標題階層降級警告
  const fixHeadingHierarchy = () => {
    let hasReplaced = false;
    document.querySelectorAll('h4').forEach(h4 => {
      // 防禦邊界條件：確保節點確實掛載在 DOM 樹上，避免脫離文件的虛擬節點引發 TypeError
      if (!h4.parentNode) return;

      const h3 = document.createElement('h3');
      
      // 1:1 完整拷貝原生屬性 (包含 Svelte 動態注入的 class、style 與資料綁定 id)
      Array.from(h4.attributes).forEach(attr => {
        h3.setAttribute(attr.name, attr.value);
      });
      
      // 轉移所有子節點與內部文字，確保 UI 渲染與排版無損
      while (h4.firstChild) {
        h3.appendChild(h4.firstChild);
      }
      
      // 在 DOM 樹中執行執行期 (Runtime) 節點替換
      h4.parentNode.replaceChild(h3, h4);
      hasReplaced = true;
    });
    
    if (hasReplaced) {
      console.debug("🛡️ 已將未依序顯示之 h4 動態重構為 h3，無障礙語意 (A11y) 階層修復完成。");
    }
  };

  // 2. 封裝 DOM 掃描邏輯：動態修正圖片路徑、背景樣式與標題語意
  const scanAndFixDOM = () => {
    fixHeadingHierarchy();

    // 處理一般圖片節點 (img 標籤)
    document.querySelectorAll('img').forEach((img, index) => {
      // 🚀 [魔術 1] 原生 Lazy Load 注入：過濾首張圖片 (保全 LCP 分數)，其餘圖片強制延遲載入
      if (index > 0 && !img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }

      // 🛡️ [極限優化新增] 強制注入實體寬高：解決 Lighthouse「圖片沒有明確寬高」警告，徹底消滅強制自動重排 (Reflow)
      if (img.classList.contains('icon')) {
        if (!img.hasAttribute('width')) img.setAttribute('width', '16');
        if (!img.hasAttribute('height')) img.setAttribute('height', '16');
      } else if (img.closest('a.logo')) {
        // 🚀 精準定位：僅針對被包在 a.logo 內的 img 本身注入 48x48，完美避開動態 class 且絕不干擾文字區塊！
        if (!img.hasAttribute('width')) img.setAttribute('width', '48');
        if (!img.hasAttribute('height')) img.setAttribute('height', '48');
      }

      let currentSrc = img.src;
      if (!currentSrc) return;
      
      let newSrc = currentSrc;
      if (newSrc.includes('/status/master/')) newSrc = fix(newSrc);
      
      if (cacheBuster && newSrc.includes('cdn.jsdelivr.net') && !newSrc.includes('t=' + cacheBuster)) {
        newSrc += (newSrc.includes('?') ? '&' : '?') + 't=' + cacheBuster;
      }
      
      if (currentSrc !== newSrc) img.src = newSrc;
    });

    // 處理 Svelte 動態注入的行內樣式背景圖 (--background: url(...))
    document.querySelectorAll('[style]').forEach(el => {
      const originalStyle = el.getAttribute('style');
      if (!originalStyle) return;
      
      let newStyle = originalStyle;
      if (newStyle.includes('/status/master/')) newStyle = fix(newStyle);
      
      if (cacheBuster && newStyle.includes('cdn.jsdelivr.net') && !newStyle.includes('t=' + cacheBuster)) {
        newStyle = newStyle.replace(/(url\(['"]?)(https:\/\/cdn\.jsdelivr\.net[^'"]+?)(['"]?\))/g, (match, p1, p2, p3) => {
           const separator = p2.includes('?') ? '&' : '?';
           return `${p1}${p2}${separator}t=${cacheBuster}${p3}`;
        });
      }

      // 嚴格防護：僅在屬性真實發生異動 (Changed) 時才回寫 DOM，徹底防止觸發 MutationObserver 無窮迴圈 (Call Stack Overflow)
      if (originalStyle !== newStyle) {
        // 🚀 [魔術 2] CSS 暴力攔截：偵測到更新後的背景網址，直接將其拔除並交給監視器延遲載入
        if (newStyle.includes('--background: url')) {
          const bgMatch = newStyle.match(/--background:\s*(url\(['"]?[^'"]+['"]?\))/);
          if (bgMatch && bgMatch[1]) {
            const styleWithoutBg = newStyle.replace(bgMatch[1], 'none');
            el.setAttribute('style', styleWithoutBg); // 寫入 "none" 阻擋瀏覽器偷跑下載
            el.dataset.lazyBg = bgMatch[1];           // 將 CDN 快取網址封印在 dataset 裡
            bgObserver.observe(el);                   // 移交 IntersectionObserver 管管
            return; // 提早結束，避免執行下方的一般寫入
          }
        }
        el.setAttribute('style', newStyle);
      }
    });
  };

  // 腳本載入時立即執行初次掃描，處理初始掛載的 DOM
  scanAndFixDOM();

  // 啟動 MutationObserver，持續監聽 Svelte 後續渲染引發的 DOM 節點異動
  new MutationObserver(scanAndFixDOM).observe(document.documentElement, { 
    childList: true, 
    subtree: true, 
    attributes: true,         
    attributeFilter: ['style', 'src']
  });

  // 3. 監聽導覽列 (Navbar) 快取強制清除事件
  document.addEventListener('click', async (e) => {
    // 利用事件委派 (Event Delegation) 尋找最近的 <a> 標籤
    const targetLink = e.target.closest('a');
    
    if (targetLink && targetLink.getAttribute('href') === '#purge-cache') {
      e.preventDefault(); 
      
      targetLink.textContent = "⏳ 快取清除中...";
      targetLink.style.pointerEvents = "none";

      const currentUrls = new Set(fetchTargets);
      
      // 蒐集網頁中所有的 img, script, link
      document.querySelectorAll('img[src], script[src], link[href]').forEach(el => {
        const url = el.src || el.href;
        // 🚀 [修復 1] 排除純網域根目錄：防禦掃描到 preconnect 標籤引發的 422 Unprocessable Content 錯誤
        if (url && url.includes('cdn.jsdelivr.net') && url !== 'https://cdn.jsdelivr.net/' && url !== 'https://cdn.jsdelivr.net') {
          currentUrls.add(url.split('?')[0]);
        }
      });

      // 蒐集行內樣式中的背景圖
      // 🚀 [修復 2] 擴大掃描範圍：一併掃描被封印在 dataset.lazyBg 中、尚未被載入的圖表網址
      document.querySelectorAll('[style], [data-lazy-bg]').forEach(el => {
        const styleAttr = el.getAttribute('style') || '';
        const lazyBg = el.dataset.lazyBg || '';
        const combinedString = styleAttr + ' ' + lazyBg;
        
        if (combinedString.includes('cdn.jsdelivr.net')) {
          const match = combinedString.match(/url\(['"]?(https:\/\/cdn\.jsdelivr\.net[^'"]+)['"]?\)/);
          if (match && match[1]) currentUrls.add(match[1].split('?')[0]);
        }
      });

      // 以並行 (Concurrent) 方式發送 jsDelivr Purge API 請求
      const purgeRequests = Array.from(currentUrls).map(url => {
        const purgeUrl = url.replace('https://cdn.jsdelivr.net/', 'https://purge.jsdelivr.net/');
        return fetch(purgeUrl, { mode: 'cors' }).catch(err => {
          console.error('❌ 清除快取請求失敗:', purgeUrl, err);
        }); 
      });

      await Promise.all(purgeRequests);

      alert("✅ CDN 快取已強制清除！即將重新載入頁面以取得最新資料。");
      
      // 執行強制重新載入 (Hard Reload) 並注入最新的快取無效化參數
      const reloadUrl = new URL(window.location.href);
      reloadUrl.hash = ''; 
      
      const pathSegments = reloadUrl.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (!reloadUrl.pathname.endsWith('/') && !lastSegment.includes('.')) {
        reloadUrl.pathname += '/';
      }
      
      reloadUrl.searchParams.set('t', Date.now());
      window.location.href = reloadUrl.toString();
    }
  });
})();
