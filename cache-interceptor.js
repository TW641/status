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

  // 1. 攔截原生 fetch 函式 (維持原樣，完全不動)
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    let reqUrl = '';
    let isRequestObject = false;

    // 判斷傳入的是單純字串網址，還是 Request 物件
    if (typeof args[0] === 'string') {
      reqUrl = args[0];
    } else if (args[0] instanceof Request) {
      reqUrl = args[0].url;
      isRequestObject = true;
    } else {
      // 若非以上兩者，直接放行給原生 fetch
      return origFetch.apply(this, args);
    }

    // 🛡️ 防護 A：精準攔截已知會消耗 API 額度的請求，直接回傳偽造的 200 OK 與空陣列
    if (reqUrl.includes('api.github.com/repos/TW641/status/issues') || 
        reqUrl.includes('api.github.com/repos/TW641/status/commits')) {
      console.warn('🛡️ 已攔截 GitHub API 請求並回傳空陣列，防止消耗額度:', reqUrl);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 🔄 替換 jsDelivr 網址以確保命中正確節點
    reqUrl = fix(reqUrl); 

    // ⚡ 處理 CDN 資源：記錄 Purge 目標，並強制加上時間戳記擊穿瀏覽器快取
    if (reqUrl.includes('cdn.jsdelivr.net')) {
      fetchTargets.add(reqUrl.split('?')[0]); // 僅記錄乾淨的網址
      
      if (cacheBuster) {
        reqUrl += (reqUrl.includes('?') ? '&' : '?') + 't=' + cacheBuster;
      }
    }

    // 將修改後的網址寫回參數中
    if (isRequestObject) {
      // 若原本是 Request 物件，需使用新網址重新實例化
      args[0] = new Request(reqUrl, args[0]);
    } else {
      args[0] = reqUrl;
    }
    
    try {
      // 發送實際的網路請求
      const response = await origFetch.apply(this, args);

      // 🛡️ 防護 B (終極防線)：若任何 GitHub API 意外回傳錯誤 (如 403 限流或 404 找不到)
      // 在前端接收到之前強制攔截，並偽裝成 200 成功狀態，防止網頁崩潰或跳轉
      if (!response.ok && reqUrl.includes('api.github.com')) {
        console.error(`⚠️ GitHub API 回傳錯誤 (${response.status})，已自動偽裝為 200 以防止前端崩潰。`);
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return response;
    } catch (error) {
      console.error('🌐 網路請求發生例外狀況:', error);
      throw error;
    }
  };

  // 2. 攔截並修正圖片網址 (處理動態生成的圖表，避免破圖)
  new MutationObserver(() => {
    // 原來的 img 邏輯 (不動)
    document.querySelectorAll('img').forEach(img => {
      if (img.src.includes('/status/master/')) {
        img.src = fix(img.src);
      }
    });

    // 🔥 新增邏輯：對症下藥，將 fix 函數也套用在包含 /status/master/ 的 style 背景圖上
    document.querySelectorAll('[style]').forEach(el => {
      const styleAttr = el.getAttribute('style');
      if (styleAttr && styleAttr.includes('/status/master/')) {
        el.setAttribute('style', fix(styleAttr));
      }
    });
  }).observe(document.body, { 
    childList: true, 
    subtree: true, 
    attributes: true,         // 🔥 必須監聽屬性，因為 Svelte 切換按鈕是修改 style 屬性
    attributeFilter: ['style'] 
  });

  // 3. 監聽導覽列 (Navbar) 按鈕，執行快取清除流程
  document.addEventListener('click', async (e) => {
    const targetLink = e.target.closest('a');
    
    if (targetLink && targetLink.getAttribute('href') === '#purge-cache') {
      e.preventDefault(); // 阻止原本的網頁跳轉行為
      
      // 視覺回饋：更改按鈕文字並停用點擊防呆
      targetLink.textContent = "⏳ 快取清除中...";
      targetLink.style.pointerEvents = "none";

      const currentUrls = new Set(fetchTargets);
      
      // 瞬間掃描當下網頁內所有資源 (不動)
      document.querySelectorAll('img[src], script[src], link[href]').forEach(el => {
        const url = el.src || el.href;
        if (url && url.includes('cdn.jsdelivr.net')) {
          currentUrls.add(url.split('?')[0]);
        }
      });

      // 🔥 新增邏輯：把 style 裡的背景圖 URL 也挖出來加入 purge 清單
      document.querySelectorAll('[style]').forEach(el => {
        const styleAttr = el.getAttribute('style');
        if (styleAttr && styleAttr.includes('cdn.jsdelivr.net')) {
          const match = styleAttr.match(/url\(['"]?(.*?)['"]?\)/);
          if (match && match[1]) {
            currentUrls.add(match[1].split('?')[0]);
          }
        }
      });

      // 準備併發發送清除快取的請求 (使用 Purge API)
      const purgeRequests = Array.from(currentUrls).map(url => {
        const purgeUrl = url.replace('https://cdn.jsdelivr.net/', 'https://purge.jsdelivr.net/');
        return fetch(purgeUrl, { mode: 'no-cors' }).catch(err => {
          console.error('❌ 清除快取請求失敗:', purgeUrl, err);
        }); 
      });

      await Promise.all(purgeRequests);

      // 通知使用者並透過附加時間戳記強制重新整理網頁
      alert("✅ CDN 快取已強制更新！網頁即將重新整理以載入最新資料。");
      const currentUrlWithoutHash = window.location.href.split('#')[0].split('?')[0];
      window.location.href = currentUrlWithoutHash + '?t=' + Date.now(); 
    }
  });
})();
