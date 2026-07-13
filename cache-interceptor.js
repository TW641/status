(function() {
  if (window.__jsDelivrScriptLoaded) return;
  window.__jsDelivrScriptLoaded = true;
  console.log("🚀 jsDelivr 路由轉換、API 速率防護、A11y 語意重構與 CDN 快取強制清除腳本已啟動！");
  const urlParams = new URLSearchParams(window.location.search);
  const cacheBuster = urlParams.get('t');
  const fix = url => typeof url === 'string' ? url.replace('/status/master/', '/status@master/') : url;
  const fetchTargets = new Set();
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/history/summary.json');
  fetchTargets.add('https://cdn.jsdelivr.net/gh/TW641/status@master/cache-interceptor.js');
  const bgObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.dataset.lazyBg) {
          el.style.setProperty('--background', el.dataset.lazyBg);
          el.removeAttribute('data-lazy-bg');
          observer.unobserve(el);
        }
      }
    });
  }, { rootMargin: '200px 0px' });
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    let reqUrl = '';
    let isRequestObject = false;
    if (typeof args[0] === 'string') {
      reqUrl = args[0];
    } else if (args[0] instanceof URL) {
      reqUrl = args[0].toString();
    } else if (args[0] instanceof Request) {
      reqUrl = args[0].url;
      isRequestObject = true;
    } else {
      return origFetch.apply(this, args);
    }
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
    if (isRequestObject) {
      args[0] = new Request(reqUrl, args[0]);
    } else {
      args[0] = reqUrl;
    }
    try {
      const response = await origFetch.apply(this, args);
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
  const fixHeadingHierarchy = () => {
    let hasReplaced = false;
    document.querySelectorAll('h4').forEach(h4 => {
      if (!h4.parentNode) return;
      const h3 = document.createElement('h3');
      Array.from(h4.attributes).forEach(attr => {
        h3.setAttribute(attr.name, attr.value);
      });
      while (h4.firstChild) {
        h3.appendChild(h4.firstChild);
      }
      h4.parentNode.replaceChild(h3, h4);
      hasReplaced = true;
    });
    if (hasReplaced) {
      console.debug("🛡️ 已將未依序顯示之 h4 動態重構為 h3，無障礙語意 (A11y) 階層修復完成。");
    }
  };
  const scanAndFixDOM = () => {
    fixHeadingHierarchy();
    document.querySelectorAll('img').forEach((img, index) => {
      if (index > 0 && !img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
      if (img.classList.contains('icon')) {
        if (!img.hasAttribute('width')) img.setAttribute('width', '16');
        if (!img.hasAttribute('height')) img.setAttribute('height', '16');
      } else if (img.closest('a.logo')) {
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
      if (originalStyle !== newStyle) {
        if (newStyle.includes('--background: url')) {
          const bgMatch = newStyle.match(/--background:\s*(url\(['"]?[^'"]+['"]?\))/);
          if (bgMatch && bgMatch[1]) {
            const styleWithoutBg = newStyle.replace(bgMatch[1], 'none');
            el.setAttribute('style', styleWithoutBg);
            el.dataset.lazyBg = bgMatch[1];
            bgObserver.observe(el);
            return;
          }
        }
        el.setAttribute('style', newStyle);
      }
    });
  };
  scanAndFixDOM();
  let scanFrame;
  new MutationObserver(() => {
    if (scanFrame) cancelAnimationFrame(scanFrame);
    scanFrame = requestAnimationFrame(scanAndFixDOM);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'src']
  });
  document.addEventListener('click', async (e) => {
    const targetLink = e.target.closest('a');
    if (targetLink && targetLink.getAttribute('href') === '#purge-cache') {
      e.preventDefault();
      targetLink.textContent = "⏳ 快取清除中...";
      targetLink.style.pointerEvents = "none";
      const currentUrls = new Set(fetchTargets);
      document.querySelectorAll('img[src], script[src], link[href]').forEach(el => {
        const url = el.src || el.href;
        if (url && url.includes('cdn.jsdelivr.net') && url !== 'https://cdn.jsdelivr.net/' && url !== 'https://cdn.jsdelivr.net') {
          currentUrls.add(url.split('?')[0]);
        }
      });
      document.querySelectorAll('[style], [data-lazy-bg]').forEach(el => {
        const styleAttr = el.getAttribute('style') || '';
        const lazyBg = el.dataset.lazyBg || '';
        const combinedString = styleAttr + ' ' + lazyBg;
        if (combinedString.includes('cdn.jsdelivr.net')) {
          const match = combinedString.match(/url\(['"]?(https:\/\/cdn\.jsdelivr\.net[^'"]+)['"]?\)/);
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
      alert("✅ CDN 快取已強制清除！即將重新載入頁面以取得最新資料。");
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
