const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyaud4jw7OyAgN_YhY228wyZKl1Z_Y0sbwT9F3tt3C-CZKAJxxXxY4gIHPmn2eUMQcWbw/exec"; 

const syncStatus = document.getElementById('syncStatus');
const ingredientsList = document.getElementById('ingredientsList');
const summary = document.getElementById('summary');
const recipesEl = document.getElementById('recipes');

let ingredients = [];

// 網頁載入後，自動執行初始化同步與食譜生成
window.addEventListener('DOMContentLoaded', autoSyncAndGenerate);

/**
 * 步驟 1：同步冰箱最新食材
 */
async function autoSyncAndGenerate() {
  if (GAS_API_URL.includes("xxxx")) {
    syncStatus.innerHTML = "<span style='color: #e74c3c;'>❌ 請先在 app.js 中填寫您的 GAS_API_URL！</span>";
    return;
  }

  try {
    syncStatus.textContent = '🔄 正在同步冰箱最新食材...';
    
    // 向 GAS 請求目前的冰箱食材清單
    const response = await fetch(GAS_API_URL);
    if (!response.ok) throw new Error('無法與試算表伺服器建立連線');
    
    const rawData = await response.json();
    
    if (rawData.status === 'error') {
      throw new Error(rawData.message);
    }

    if (!Array.isArray(rawData)) {
      throw new Error('回傳格式錯誤');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeIngredients = [];
    let expiredCount = 0;

    // 日期安全檢查與過濾（自動排除過期食材）
    rawData.forEach(item => {
      if (!item.category) return;

      if (item.expiry_date) {
        const expDate = new Date(item.expiry_date);
        if (expDate < today) {
          expiredCount++;
          return; // 已過期則排除
        }
      }
      activeIngredients.push(item.category.trim());
    });

    if (activeIngredients.length === 0) {
      syncStatus.textContent = '🫙 目前冰箱空空如也（或食材皆已過期）';
      summary.textContent = expiredCount > 0 ? `（已自動過濾了 ${expiredCount} 個過期食材）` : '';
      recipesEl.innerHTML = '<div style="text-align:center; color:#95a5a6;">冰箱內沒有可用新鮮食材，無法生成食譜。</div>';
      return;
    }

    // 成功取得食材，渲染到前端畫面
    ingredients = activeIngredients;
    renderIngredientChips();
    
    let statusText = `✅ 同步成功！偵測到冰箱有 ${ingredients.length} 種新鮮/即期食材。`;
    if (expiredCount > 0) statusText += `（已排除 ${expiredCount} 項過期品）`;
    syncStatus.innerHTML = `<span style='color: #27ae60;'>${statusText}</span>`;

    // 依食材數量評估要請 AI 生成幾道菜（AI 生成較耗時，建議上限設為 2~3 道）
    const recommendedCount = evaluateRecipeCount(ingredients.length);
    summary.textContent = `🤖 AI 正在根據您的即期食材多樣性，量身打造 ${recommendedCount} 道創意食譜...`;

    // 步驟 2：呼叫後端 GAS 讓 AI 廚神動態生成食譜
    await fetchAndRenderAIRecipes(recommendedCount);

  } catch (err) {
    syncStatus.innerHTML = `<span style='color: #e74c3c;'>❌ 同步失敗: ${err.message}</span>`;
    recipesEl.innerHTML = '<div style="text-align:center; color:#e74c3c;">請確認您的 GAS 是否有正常發佈，且權限設為「任何人」。</div>';
  }
}

/**
 * 步驟 2：向 GAS 發送指令，請求 AI 生成食譜
 */
async function fetchAndRenderAIRecipes(count) {
  try {
    recipesEl.innerHTML = '<div style="text-align:center; color:#3498db; padding: 20px;">🍳 AI 正在看著食材沉思中，請稍候...</div>';
    
    // 帶上 action 參數與數量限制，請求後端 GAS 呼叫 Gemini API
    const aiUrl = `${GAS_API_URL}?action=generateRecipes&count=${count}`;
    const response = await fetch(aiUrl);
    
    if (!response.ok) throw new Error('AI 食譜伺服器回應異常');
    
    const aiRecipes = await response.json();
    
    // 將 AI 回傳的食譜資料渲染到畫面上
    renderRecipesToDOM(aiRecipes);
    
  } catch (err) {
    recipesEl.innerHTML = `<div style="text-align:center; color:#e74c3c; padding: 20px;">❌ AI 食譜生成失敗: ${err.message}</div>`;
  }
}

/**
 * 評估推薦菜色數量的智慧演算法
 */
function evaluateRecipeCount(ingredientLength) {
  if (ingredientLength <= 2) return 1;
  if (ingredientLength <= 4) return 2;
  return 3; // AI 生成上限設為 3 道
}

/**
 * 渲染食材標籤 (唯讀顯示)
 */
function renderIngredientChips() {
  ingredientsList.innerHTML = '';
  ingredients.forEach(i => {
    const el = document.createElement('div');
    el.className = 'chip selected'; 
    el.textContent = i;
    ingredientsList.appendChild(el);
  });
}

/**
 * 將 AI 傳回的結構化 JSON 資料，完美套用 HTML 樣式渲染，並在前端繪製 QR Code
 */
function renderRecipesToDOM(recipesList) {
  recipesEl.innerHTML = '';
  
  recipesList.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'recipe';
    
    // 1. 食譜標題
    const h = document.createElement('h3'); 
    h.textContent = r.title;
    
    // 2. 料理 Meta 資訊
    const meta = document.createElement('div'); 
    meta.className = 'meta'; 
    meta.textContent = `方式 ${r.method} · 時間 ${r.time} · 份量 ${r.servings} 人份`;
    
    // 3. 食材清單 (包含即期食材與自備配料)
    const ul = document.createElement('ul');
    r.ingredients.forEach(it => {
      const li = document.createElement('li'); 
      li.textContent = it;
      ul.appendChild(li);
    });
    
    // 4. 料理步驟
    const stepsDiv = document.createElement('div');
    r.steps.forEach(s => {
      const ps = document.createElement('p'); 
      ps.textContent = s;
      stepsDiv.appendChild(ps);
    });

    // 5. 整合 YouTube 搜尋與前端 QR Code
    // 利用「菜名 + 兩個食材名稱」組合出最精準的 YouTube 實作影片搜尋網址
    const query = r.title + ' ' + r.ingredients.slice(0, 2).map(item => item.split('（')[0]).join(' ');
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' 做法 教學')}`;
    
    const footerContainer = document.createElement('div');
    footerContainer.style.display = 'flex';
    footerContainer.style.justifyContent = 'space-between';
    footerContainer.style.alignItems = 'center';
    footerContainer.style.marginTop = '15px';
    footerContainer.style.paddingTop = '15px';
    footerContainer.style.borderTop = '1px solid #eee';

    // 左側：YouTube 連結
    const leftBox = document.createElement('div');
    const link = document.createElement('a');
    link.href = ytUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '📺 點此看 YouTube 教學影片';
    link.style.fontWeight = 'bold';
    link.style.color = '#e74c3c';
    link.style.textDecoration = 'none';
    leftBox.appendChild(link);

    // 右側：掃描 QR Code 區塊
    const qrBox = document.createElement('div');
    qrBox.style.textAlign = 'center';
    qrBox.style.fontSize = '0.8rem';
    qrBox.style.color = '#7f8c8d';
    
    const qrCanvasContainer = document.createElement('div');
    // 直接呼叫前端的 QRCode 渲染函數，當場在瀏覽器繪製
    createQrForUrl(ytUrl, qrCanvasContainer);
    
    qrBox.appendChild(qrCanvasContainer);
    qrBox.appendChild(document.createTextNode('📱 手機掃描看影片'));

    footerContainer.appendChild(leftBox);
    footerContainer.appendChild(qrBox);

    // 組合整張卡片
    card.appendChild(h);
    card.appendChild(meta);
    card.appendChild(ul);
    card.appendChild(stepsDiv);
    card.appendChild(footerContainer);
    recipesEl.appendChild(card);
  });
}

/**
 * 前端 Canvas QR Code 繪製函數
 */
function createQrForUrl(url, container) {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  QRCode.toCanvas(canvas, url, { width: 120, margin: 1 }, function (err) {
    if (err) {
      // 降級防呆：若本地套件繪製失敗，自動切換至 Google API 圖片
      const img = document.createElement('img');
      img.src = `https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=${encodeURIComponent(url)}`;
      container.appendChild(img);
      return;
    }
    container.appendChild(canvas);
  });
}