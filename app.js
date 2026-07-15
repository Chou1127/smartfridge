import QRCode from "https://esm.sh/qrcode@1.5.1";

// ==========================================
// ⚠️ 請在此處貼上你部署好的 GAS 網頁應用程式 URL
// ==========================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyaud4jw7OyAgN_YhY228wyZKl1Z_Y0sbwT9F3tt3C-CZKAJxxXxY4gIHPmn2eUMQcWbw/exec"; 

const syncStatus = document.getElementById('syncStatus');
const ingredientsList = document.getElementById('ingredientsList');
const summary = document.getElementById('summary');
const recipesEl = document.getElementById('recipes');

let ingredients = [];

// 網頁載入後，自動執行初始化同步
window.addEventListener('DOMContentLoaded', autoSyncAndGenerate);

async function autoSyncAndGenerate() {
  if (GAS_API_URL.includes("xxxx")) {
    syncStatus.innerHTML = "<span style='color: #e74c3c;'>❌ 請先在 app.js 中填寫您的 GAS_API_URL！</span>";
    return;
  }

  try {
    syncStatus.textContent = '🔄 正在同步冰箱最新食材...';
    
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

    rawData.forEach(item => {
      if (!item.category) return;

      // 日期安全檢查與過濾
      if (item.expiry_date) {
        const expDate = new Date(item.expiry_date);
        if (expDate < today) {
          expiredCount++;
          return; // 過期則自動排除
        }
      }
      activeIngredients.push(item.category.trim());
    });

    if (activeIngredients.length === 0) {
      syncStatus.textContent = '🫙 目前冰箱空空如也（或食材皆已過期）';
      summary.textContent = expiredCount > 0 ? `（已自動過濾了 ${expiredCount} 個過期食材）` : '';
      recipesEl.innerHTML = '<div style="text-align:center; color:#95a5a6;">冰箱內沒有可用食材，無法生成食譜。</div>';
      return;
    }

    // 成功取得食材，渲染到畫面上
    ingredients = activeIngredients;
    renderIngredientChips();
    
    let statusText = `✅ 同步成功！偵測到冰箱有 ${ingredients.length} 種新鮮食材。`;
    if (expiredCount > 0) statusText += `（已排除 ${expiredCount} 項過期品）`;
    syncStatus.innerHTML = `<span style='color: #27ae60;'>${statusText}</span>`;

    // 依食材數量自動評估要生成幾道菜
    const recommendedCount = evaluateRecipeCount(ingredients.length);
    summary.textContent = `根據目前食材多樣性，自動為您規劃並生成 ${recommendedCount} 道最推薦料理：`;

    // 直接生成食譜
    generateRecipes(recommendedCount);

  } catch (err) {
    syncStatus.innerHTML = `<span style='color: #e74c3c;'>❌ 同步失敗: ${err.message}</span>`;
    recipesEl.innerHTML = '<div style="text-align:center; color:#e74c3c;">請確認您的 GAS 是否有正常發佈，且權限設為「任何人」。</div>';
  }
}

// 根據食材數量智慧評估推薦道數的演算法
function evaluateRecipeCount(ingredientLength) {
  if (ingredientLength <= 2) return 1;
  if (ingredientLength <= 4) return 2;
  if (ingredientLength <= 6) return 3;
  return 4; // 食材很多時，最多推薦 4 道美味組合
}

// 渲染食材晶片 (唯讀顯示)
function renderIngredientChips() {
  ingredientsList.innerHTML = '';
  ingredients.forEach(i => {
    const el = document.createElement('div');
    el.className = 'chip selected'; // 直接預設選中，不再提供手動點擊
    el.textContent = i;
    ingredientsList.appendChild(el);
  });
}

/* 以下為食譜演算法核心（維持原本邏輯，移除沒用到的按鈕與變數） */
function pickRandom(arr, n) {
  const out = [];
  const copy = arr.slice();
  while(out.length < n && copy.length){
    const idx = Math.floor(Math.random()*copy.length);
    out.push(copy.splice(idx,1)[0]);
  }
  return out;
}

function containsKeyword(list, keywords) {
  return keywords.some(k => list.some(i => i.includes(k)));
}

function titleFromIngredients(list) {
  const protein = list.find(i => /chicken|pork|beef|fish|shrimp|egg|tofu|雞|豬|牛|魚|蝦|蛋|豆腐/.test(i));
  const carb = list.find(i => /rice|麵|pasta|bread|吐司|飯|麵包|義大利/.test(i));
  if(protein && carb) return `${protein} ${carb} 料理`;
  if(protein) return `${protein} 的簡單做法`;
  if(carb) return `${carb} 風味料理`;
  return `${list.slice(0,3).join('、')} 料理`;
}

function gramsSuggestion(item) {
  if(/雞|豬|牛|fish|fish|蝦|shrimp/.test(item)) return '150-200g';
  if(/蛋|egg/.test(item)) return '1-2 顆';
  if(/rice|飯/.test(item)) return '1 碗（約150g 熟飯）';
  if(/tofu|豆腐/.test(item)) return '150-200g';
  return '';
}

function generateRecipeFromIngredients(mainList, variantIndex = 0) {
  const title = titleFromIngredients(mainList);
  let time = '30 分';
  let steps = [];
  let servings = 2;
  let method = '拌炒';

  const possibleMethods = ['拌炒','煎','燉','烤','涼拌','煮'];
  if(containsKeyword(mainList, ['egg','蛋'])) method = '拌炒';
  else if(containsKeyword(mainList, ['tofu','豆腐'])) method = ['煎','燉'][variantIndex % 2];
  else if(containsKeyword(mainList, ['rice','飯'])) method = '拌炒';
  else if(containsKeyword(mainList, ['pasta','義大利麵','麵'])) method = '煮';
  else if(containsKeyword(mainList, ['chicken','雞','雞肉','fish','魚'])) method = possibleMethods[variantIndex % possibleMethods.length];
  else method = possibleMethods[variantIndex % possibleMethods.length];

  const pantry = { salt:'1/2 小匙', pepper:'1/4 小匙', oil:'1-2 大匙', soy:'1 大匙', garlic:'1-2 瓣' };
  const main = mainList.slice();
  const primary = main[0] || '';

  if(method === '拌炒'){
    time = '20-35 分';
    steps.push('準備：將所有食材洗淨、切好（較硬的切小塊，葉菜類切段）。');
    if(gramsSuggestion(primary)) steps.push(`食材建議份量：${main.map(m=> (gramsSuggestion(m) ? `${m} ${gramsSuggestion(m)}` : m)).join('；')}`);
    steps.push(`熱鍋入 ${pantry.oil}，先放蒜末小火爆香（約20秒）。`);
    steps.push('依序下較硬的食材（如洋蔥、胡蘿蔔）以中大火翻炒 2-4 分鐘，再加入較軟或已熟的食材拌炒。');
    if(containsKeyword(mainList, ['egg','蛋'])){
      steps.push('在鍋邊推出空位，倒入打散的蛋快速炒至凝固再與其他食材混合。');
    }
    steps.push(`調味：加入 ${pantry.soy}、鹽 ${pantry.salt}、黑胡椒 ${pantry.pepper}，試味後可依喜好加少許糖或香油。`);
    steps.push('最後以大火快速收汁並拌勻，盛盤前撒上蔥花或芝麻提味。');
  } else if(method === '煎'){
    time = '15-30 分';
    steps.push('準備：肉類拍乾、以鹽與黑胡椒基本醃 10 分鐘。');
    if(gramsSuggestion(primary)) steps.push(`建議：${primary} 約 ${gramsSuggestion(primary)} 為一份。`);
    steps.push('熱鍋加油（中大火），放入主料每面煎 3-6 分鐘（視厚度），煎到金黃後轉小火加蓋悶熟 2-5 分鐘。');
    steps.push('取出靜置 3 分鐘再切片，利用鍋底肉汁加入少許水/酒與醬油煮成簡單醬汁淋上。');
    steps.push('配菜：同鍋加入洋蔥或菇類煎至軟化，作為配菜。');
  } else if(method === '燉'){
    time = '40-60 分';
    steps.push('準備：將主料切塊，洋蔥切絲，蒜切片。');
    steps.push('鍋中加油，中火將洋蔥與蒜炒至半透明，加入肉類煎至表面上色。');
    steps.push('加入高湯（或水）直到蓋過食材，放入喜歡的香料（如月桂葉、迷迷香）小火燉煮 30-45 分鐘至軟爛。');
    steps.push('收汁：若汁液過多可大火收至濃稠，最後以鹽與黑胡椒調味。');
  } else if(method === '烤'){
    time = '25-50 分';
    steps.push('預熱烤箱至 200°C（熱風 190°C）。');
    steps.push('將主料切塊，與橄欖油、鹽、黑胡椒和喜歡的香草拌勻，鋪在烤盤上。');
    steps.push('放入烤箱 15-35 分鐘（視食材與大小），中途翻面一次，烤至表面金黃並熟透。');
    steps.push('烤好後靜置 3 分鐘再上桌，可擠檸檬汁提味。');
  } else if(method === '涼拌'){
    time = '10-20 分';
    steps.push('將蔬菜洗淨切條或切片，若為根莖類可先汆燙 1-2 分鐘後冰水冷卻。');
    steps.push('調醬：混合醬油 1 大匙、米醋 1 大匙、香油 1/2 小匙、糖少許與蒜末拌勻。');
    steps.push('將食材與醬汁拌勻，最後撒上芝麻或蔥花。');
  } else if(method === '煮'){
    time = '12-25 分';
    steps.push('煮水：燒開加鹽，放入麵條煮至 al dente，撈起並保留半杯煮麵水。');
    steps.push('熱鍋拌炒主料，加入少量煮麵水與調味料（奶油或番茄醬）拌勻後加入麵條翻拌。');
    steps.push('試味，必要時用煮麵水調整濕潤度，最後撒上起司或香草。');
  }

  const seasoning = `建議調味：鹽 ${pantry.salt}、黑胡椒 ${pantry.pepper}，若喜歡可加醬油或辣椒。`;
  const plating = '上桌建議：以新鮮香草或蔥花點綴，配一碗簡單配菜或清湯。';

  return {
    title,
    method,
    time,
    servings,
    ingredients: mainList.map(i => gramsSuggestion(i) ? `${i}（建議 ${gramsSuggestion(i)}）` : i),
    steps: steps.concat([seasoning, plating])
  };
}

function generateYouTubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' 做法 教學')}`;
}

function createQrForUrl(url, container) {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  QRCode.toCanvas(canvas, url, { width: 120, margin: 1 }, function (err) {
    if (err) {
      const img = document.createElement('img');
      img.src = `https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=${encodeURIComponent(url)}`;
      container.appendChild(img);
      return;
    }
    container.appendChild(canvas);
  });
}

function generateRecipes(count) {
  recipesEl.innerHTML = '';
  
  const sourceIngredients = ingredients.slice();
  const out = [];

  // 分類食材增加組合多樣性
  const proteins = sourceIngredients.filter(i => /chicken|pork|beef|fish|shrimp|egg|tofu|雞|豬|牛|魚|蝦|蛋|豆腐/.test(i));
  const carbs = sourceIngredients.filter(i => /rice|麵|pasta|bread|吐司|飯|麵包|義大利/.test(i));
  const vegs = sourceIngredients.filter(i => /lettuce|cabbage|carrot|tomato|洋蔥|青椒|小黃瓜|菜|蔬菜|菠菜|玉米|香菇|菇/.test(i));

  const candidateSets = [];
  if (proteins.length) {
    proteins.forEach(p => {
      const set = [p];
      if (vegs.length) set.push(pickRandom(vegs, 1)[0]);
      if (carbs.length) set.push(pickRandom(carbs, 1)[0]);
      candidateSets.push(set);
    });
  }
  if (carbs.length) {
    carbs.forEach(c => {
      const set = [c];
      if (vegs.length) set.push(pickRandom(vegs, 1)[0]);
      if (!proteins.length && sourceIngredients.length > 1) set.push(pickRandom(sourceIngredients.filter(x => x !== c), 1)[0]);
      candidateSets.push(set);
    });
  }
  for (let i = 0; i < Math.max(6, count); i++) {
    const n = Math.min(5, Math.max(2, Math.floor(Math.random() * 4) + 1));
    candidateSets.push(pickRandom(sourceIngredients, n));
  }

  const seenSigs = new Set();
  const filtered = [];
  candidateSets.forEach(s => {
    const sig = s.slice().sort().join('|');
    if (!seenSigs.has(sig) && s.length > 0) {
      seenSigs.add(sig);
      filtered.push(s);
    }
  });

  for (let i = 0; i < count; i++) {
    const set = filtered[i] || filtered[i % filtered.length] || pickRandom(sourceIngredients, Math.min(3, sourceIngredients.length));
    const recipe = generateRecipeFromIngredients(set, i);
    out.push(recipe);
  }

  // 渲染食譜與 YouTube 連結與 QR Code
  out.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'recipe';
    
    const h = document.createElement('h3'); 
    h.textContent = r.title;
    
    const meta = document.createElement('div'); 
    meta.className = 'meta'; 
    meta.textContent = `方式 ${r.method} · 時間 ${r.time} · 份量 ${r.servings} 人份`;
    
    const ul = document.createElement('ul');
    r.ingredients.forEach(it => {
      const li = document.createElement('li'); 
      li.textContent = it;
      ul.appendChild(li);
    });
    
    const stepsDiv = document.createElement('div');
    r.steps.forEach(s => {
      const ps = document.createElement('p'); 
      ps.textContent = s;
      stepsDiv.appendChild(ps);
    });

    // 連結與 QR Code 整合區域
    const query = r.title + ' ' + r.ingredients.slice(0, 2).join(' ');
    const ytUrl = generateYouTubeSearchUrl(query);
    
    const footerContainer = document.createElement('div');
    footerContainer.style.display = 'flex';
    footerContainer.style.justifyContent = 'space-between';
    footerContainer.style.alignItems = 'center';
    footerContainer.style.marginTop = '15px';
    footerContainer.style.paddingTop = '15px';
    footerContainer.style.borderTop = '1px solid #eee';

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

    const qrBox = document.createElement('div');
    qrBox.style.textAlign = 'center';
    qrBox.style.fontSize = '0.8rem';
    qrBox.style.color = '#7f8c8d';
    
    const qrCanvasContainer = document.createElement('div');
    createQrForUrl(ytUrl, qrCanvasContainer);
    
    qrBox.appendChild(qrCanvasContainer);
    qrBox.appendChild(document.createTextNode('📱 手機掃描看影片'));

    footerContainer.appendChild(leftBox);
    footerContainer.appendChild(qrBox);

    card.appendChild(h);
    card.appendChild(meta);
    card.appendChild(ul);
    card.appendChild(stepsDiv);
    card.appendChild(footerContainer);
    recipesEl.appendChild(card);
  });
}