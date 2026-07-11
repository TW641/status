(function() {
  // 🛡️ 終極防護：防止腳本被 Svelte 或瀏覽器重複執行，造成事件綁定兩次（解決跑兩輪、跳兩次 Alert 的真兇）
  if (window.__jsDelivrScriptLoaded) return;
  window.__jsDelivrScriptLoaded = true;

  console.log("🚀 jsDelivr 轉換、API 防護、無障礙 H4 語意修正與精準清除快取腳本已啟動！");

  // 取得網址列的快取破壞者 (Cache Buster) 參數
  const urlParams = new URLSearchParams(window.location.search);
  const cacheBuster = urlParams.get('t');

  // 核心邏輯：將舊版 /status/master/ 替換為新版 /status@master/
  const fix = url => typeof url === 'string' ? url.replace('/status/master/', '/status@master/') : url;

  // 記錄需要清除快取的 CDN 資源網址
  const fetchTargets = new Set();
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/history/summary.json');
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/cache-interceptor.js');

  // 1. 攔截原生 fetch 函式
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    let reqUrl = '';
    let isRequestObject = false;

    if (typeof args[0] === 'string') {
      reqUrl = args[0];
    } else if (args[0] instanceof Request) {
      reqUrl = args[0].url;
      isRequestObject = true;
    } else {
      return origFetch.apply(this, args);
    }

    if (reqUrl.includes('api.github.com/repos/TW641/status/issues') || 
        reqUrl.includes('api.github.com/repos/TW641/status/commits')) {
      console.warn('🛡️ 已攔截 GitHub API 請求並回傳空陣列，防止消耗額度:', reqUrl);
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

    if (isRequestObject) {
      args[0] = new Request(reqUrl, args[0]);
    } else {
      args[0] = reqUrl;
    }
    
    try {
      const response = await origFetch.apply(this, args);
      if (!response.ok && reqUrl.includes('api.github.com')) {
        console.error(`⚠️ GitHub API 回傳錯誤 (${response.status})，已自動偽裝為 200 以防止前端崩潰。`);
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return response;
    } catch (error) {
      console.error('🌐 網路請求發生例外狀況:', error);
      throw error;
    }
  };

  // 🛠️ 核心優化：強迫重構標題階層（將錯誤的 h4 動態修正為標準的 h3，修復 Lighthouse 無障礙扣分）
  const fixHeadingHierarchy = () => {
    document.querySelectorAll('h4').forEach(h4 => {
      // 建立一個標準的 h3 標籤
      const h3 = document.createElement('h3');
      
      // 點對點複製所有原生的屬性（包含 Svelte 動態注入的 class、style 與 id 等）
      Array.from(h4.attributes).forEach(attr => {
        h3.setAttribute(attr.name, attr.value);
      });
      
      // 轉移所有的子節點與文字內容，確保原本的 UI 樣式與排版一字不差
      while (h4.firstChild) {
        h3.appendChild(h4.firstChild);
      }
      
      // 在 DOM 樹中執行精準替換
      h4.parentNode.replaceChild(h3, h4);
      console.log("🛡️ 已成功將未依序顯示之 h4 標籤重構為標準 h3 語意標籤，無障礙架構修復完成。");
    });
  };

  // 2. 封裝 DOM 掃描邏輯：確保圖片快取與標題語意都被精準攔截
  const scanAndFixDOM = () => {
    // 執行無障礙標題階層修正
    fixHeadingHierarchy();

    // 處理常規圖片 (img 標籤)
    document.querySelectorAll('img').forEach(img => {
      let currentSrc = img.src;
      if (!currentSrc) return;
      
      let newSrc = currentSrc;
      if (newSrc.includes('/status/master/')) newSrc = fix(newSrc);
      
      if (cacheBuster && newSrc.includes('cdn.jsdelivr.net') && !newSrc.includes('t=' + cacheBuster)) {
        newSrc += (newSrc.includes('?') ? '&' : '?') + 't=' + cacheBuster;
      }
      
      if (currentSrc !== newSrc) img.src = newSrc;
    });

    // 處理寫在 style 裡面的背景圖 (針對 Svelte 動態注入的 --background: url(...))
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

      // 只有真正改變時才寫入，防堵 MutationObserver 無限迴圈
      if (originalStyle !== newStyle) {
        el.setAttribute('style', newStyle);
      }
    });
  };

  // 腳本載入時立即執行初次攔截，阻擊漏網之魚
  scanAndFixDOM();

  // 啟動進級版 MutationObserver，動態監聽並隨時擊穿 Svelte 後續渲染的 h4 與資源變動
  new MutationObserver(scanAndFixDOM).observe(document.documentElement, { 
    childList: true, 
    subtree: true, 
    attributes: true,         
    attributeFilter: ['style', 'src']
  });

  // 3. 監聽導覽列 (Navbar) 按鈕，執行快取清除流程
  document.addEventListener('click', async (e) => {
    const targetLink = e.target.closest('a');
    
    if (targetLink && targetLink.getAttribute('href') === '#purge-cache') {
      e.preventDefault(); 
      
      targetLink.textContent = "⏳ 快取清除中...";
      targetLink.style.pointerEvents = "none";

      const currentUrls = new Set(fetchTargets);
      
      // 收集 img, script, link
      document.querySelectorAll('img[src], script[src], link[href]').forEach(el => {
        const url = el.src || el.href;
        if (url && url.includes('cdn.jsdelivr.net')) currentUrls.add(url.split('?')[0]);
      });

      // 收集 style 裡的背景圖
      document.querySelectorAll('[style]').forEach(el => {
        const styleAttr = el.getAttribute('style');
        if (styleAttr && styleAttr.includes('cdn.jsdelivr.net')) {
          const match = styleAttr.match(/url\(['"]?(https:\/\/cdn\.jsdelivr\.net[^'"]+)['"]?\)/);
          if (match && match[1]) currentUrls.add(match[1].split('?')[0]);
        }
      });

      const purgeRequests = Array.from(currentUrls).map(url => {
        const purgeUrl = url.replace('https://cdn.jsdelivr.net/', 'https://purge.jsdelivr.net/');
        return fetch(purgeUrl, { mode: 'cors' }).catch(err => {
          console.error('❌ 清除快取請求失敗:', purgeUrl, err);
        }); 
      });

      await Promise.all(purgeRequests);

      alert("✅ CDN 快取已強制更新！網頁即將重新整理以載入最新資料。");
      
      const reloadUrl = new URL(window.location.href);
      reloadUrl.hash = ''; // 清除錨點 (hash)
      
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
