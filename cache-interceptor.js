(function() {
  console.log("🚀 jsDelivr 轉換、API 防護與精準清除快取腳本已啟動！");

  // 取得網址列的快取破壞者 (Cache Buster) 參數
  const urlParams = new URLSearchParams(window.location.search);
  const cacheBuster = urlParams.get('t');

  // 核心邏輯：將舊版 /status/master/ 替換為新版 /status@master/
  const fix = url => typeof url === 'string' ? url.replace('/status/master/', '/status@master/') : url;

  // 記錄需要清除快取的 CDN 資源網址
  const fetchTargets = new Set();
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/history/summary.json');

  // 1. 攔截原生 fetch 函式 (維持不動)
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

  // 2. 封裝 DOM 掃描邏輯：確保 Svelte 注入的背景圖與常規圖片都被擊穿快取
  const scanAndFixDOM = () => {
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

  // 🔥 關鍵優化：腳本載入時先強制掃描一次，防止漏網之魚
  scanAndFixDOM();

  // 啟動 MutationObserver，持續監聽 Svelte 後續的按鈕切換與 DOM 變動
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

      // 收集 style 裡的背景圖 (再次確保目前畫面上的資源都被 Purge)
      document.querySelectorAll('[style]').forEach(el => {
        const styleAttr = el.getAttribute('style');
        if (styleAttr && styleAttr.includes('cdn.jsdelivr.net')) {
          const match = styleAttr.match(/url\(['"]?(https:\/\/cdn\.jsdelivr\.net[^'"]+)['"]?\)/);
          // 使用 split('?')[0] 確保 Purge 請求是針對「乾淨的網址」，而不是帶有時間戳的網址
          if (match && match[1]) currentUrls.add(match[1].split('?')[0]);
        }
      });

      // 準備併發發送清除快取的請求
      const purgeRequests = Array.from(currentUrls).map(url => {
        const purgeUrl = url.replace('https://cdn.jsdelivr.net/', 'https://purge.jsdelivr.net/');
        return fetch(purgeUrl, { mode: 'no-cors' }).catch(err => {
          console.error('❌ 清除快取請求失敗:', purgeUrl, err);
        }); 
      });

      await Promise.all(purgeRequests);

      alert("✅ CDN 快取已強制更新！網頁即將重新整理以載入最新資料。");
      
      const reloadUrl = new URL(window.location.href);
      reloadUrl.hash = ''; // 清除錨點 (hash)
      
      // 單獨針對網頁路徑處理：如果結尾沒有斜線，且不是具體的檔案 (例如沒有包含 .html)，就補上斜線避免 GitHub Pages 301 轉址
      const pathSegments = reloadUrl.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (!reloadUrl.pathname.endsWith('/') && !lastSegment.includes('.')) {
        reloadUrl.pathname += '/';
      }
      
      // 使用原生的 searchParams 安全地寫入時間戳記
      reloadUrl.searchParams.set('t', Date.now());
      window.location.href = reloadUrl.toString();
    }
  });
})();
