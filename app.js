// MUÑOZ MARCHESI — Shared App JS
const SB_URL       = "https://ncagcvtkporoapumenoo.supabase.co";
const SB_KEY       = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jYWdjdnRrcG9yb2FwdW1lbm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODI4NDQsImV4cCI6MjA5OTY1ODg0NH0.7LyvoGFFI4KWRDq5JgNFOpkGjtlplTDRX_kCHjoXXNc";
const SERVIDOR_URL = "https://munoz-app-server.onrender.com";
const PRICE_MARKUP = 1.05;
const PROD_PER_PAGE = 20;

// ── UTILS ──────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function parsePrice(p){ if(typeof p==='number') return p; return parseFloat(String(p).replace(/[^0-9.]/g,''))||0; }
function roundClean(n){
  if(!n||n<=0) return 0;
  if(n<1000)    return Math.round(n/10)*10;
  if(n<10000)   return Math.round(n/100)*100;
  if(n<100000)  return Math.round(n/500)*500;
  if(n<1000000) return Math.round(n/1000)*1000;
  return Math.round(n/10000)*10000;
}
function applyMarkup(p){ const v=parsePrice(p); return v?roundClean(v*PRICE_MARKUP):0; }
function fmtPrice(n){ return '$'+Math.round(n).toLocaleString('es-AR').replace(/,/g,'.'); }
function formatCodigo(c){ const n=String(c).split('.')[0].replace(/[^0-9]/g,''); return n.length===4?'0'+n:n; }
function getCatIcon(cat){
  const icons={carniceria:'🥩',panaderia:'🍞',cocina:'🍳',peluqueria:'✂️',exhibicion:'🏪',textil:'🧵',refrigeracion:'❄️',mobiliario:'🪑',pequeno_equip:'🔌',bazar:'🛍️'};
  return icons[cat]||'📦';
}
function scrollToSection(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}); }

// ── STATE ──────────────────────────────────────────────────
let allProducts = [], categorias = [], cart = [], planes = [];
let filteredProducts = [], prodPage = 1;
let planSeleccionado = null, checkoutStep = 1;
let heroSlides = [], heroIndex = 0, heroInterval = null;

// ── SUPABASE ───────────────────────────────────────────────
async function sbFetch(path){
  const res = await fetch(`${SB_URL}/rest/v1/${path}`,{
    headers:{'apikey':SB_KEY,'Authorization':`Bearer ${SB_KEY}`,'Content-Type':'application/json'}
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── DATA LOADING ───────────────────────────────────────────
async function loadCategorias(){
  try {
    const res = await sbFetch('categorias?select=*&activa=eq.true&order=orden.asc');
    categorias = res || [];
    populateCatDropdown();
    populateCatFilter();
  } catch(e){ console.error('Categorias:', e); }
}

async function loadProductos(){
  try {
    const res = await sbFetch('articulos_final?select=codigo,nombre,descripcion,precio,categoria,imagen_url&activo=eq.true&order=nombre.asc');
    allProducts = (res||[]).map(p=>({
      codigo:String(p.codigo||''), nombre:String(p.nombre||''),
      descripcion:String(p.descripcion||''), precio:parsePrice(p.precio),
      categoria:String(p.categoria||'bazar'), imagen:String(p.imagen_url||''),
    }));
    filteredProducts = [...allProducts];
    // Update cat counts if cat grid exists
    if(document.getElementById('cat-grid')) renderCatGrid();
    // Render products if prod-grid exists
    if(document.getElementById('prod-grid')) renderProducts();
  } catch(e){ console.error('Productos:', e); }
}

async function loadPlanes(){
  try {
    const res = await sbFetch('planes_pago?select=*&activo=eq.true&order=orden.asc');
    planes = (res||[]).map((p,i)=>({id:i===0?'contado':p.cuotas+'c',label:p.label,cuotas:p.cuotas,interes:parseFloat(p.interes)||0}));
  } catch(e){ planes=[{id:'contado',label:'Contado',cuotas:1,interes:0}]; }
}

async function loadConfig(){
  try {
    const res = await sbFetch('config_app?select=clave,valor');
    const map = {};
    (res||[]).forEach(r=>map[r.clave]=r.valor);
    const heroType = map['web_hero_tipo'] || 'video';
    if(heroType==='video' && map['web_hero_video_url']){
      setupHeroVideo(map['web_hero_video_url']);
    } else if(heroType==='imagenes' && map['web_hero_imagenes']){
      const imgs = map['web_hero_imagenes'].split(',').map(s=>s.trim()).filter(Boolean);
      if(imgs.length) setupHeroSlideshow(imgs);
    }
  } catch(e){ console.log('Config error:', e); }
}

// ── HERO ───────────────────────────────────────────────────
function setupHeroVideo(url){
  const media = document.getElementById('hero-media');
  if(!media) return;
  media.innerHTML = `<video class="hero-video" autoplay muted loop playsinline><source src="${url}" type="video/mp4"></video>`;
}

function setupHeroSlideshow(images){
  const media = document.getElementById('hero-media');
  const indicators = document.getElementById('hero-indicators');
  if(!media) return;
  heroSlides = images;
  media.innerHTML = `<div class="hero-slides">${images.map((img,i)=>`<div class="hero-slide ${i===0?'active':''}" style="background-image:url('${img}')"></div>`).join('')}</div>`;
  if(indicators) indicators.innerHTML = images.map((_,i)=>`<div class="hero-dot ${i===0?'active':''}" onclick="goHeroSlide(${i})"></div>`).join('');
  // Hide hero text content when showing images slideshow
  const content = document.getElementById('hero-content');
  if(content) content.style.display = 'none';
  clearInterval(heroInterval);
  heroInterval = setInterval(()=>{ heroIndex=(heroIndex+1)%images.length; updateHeroSlide(); }, 4000);
}

function goHeroSlide(idx){ heroIndex=idx; updateHeroSlide(); clearInterval(heroInterval); heroInterval=setInterval(()=>{heroIndex=(heroIndex+1)%heroSlides.length;updateHeroSlide();},4000); }
function updateHeroSlide(){
  document.querySelectorAll('.hero-slide').forEach((s,i)=>s.classList.toggle('active',i===heroIndex));
  document.querySelectorAll('.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===heroIndex));
}

// ── NAV ────────────────────────────────────────────────────
function toggleMobileMenu(){ document.getElementById('mobile-menu').classList.toggle('open'); }
function toggleCatDropdown(){ document.getElementById('nav-cat-dropdown').classList.toggle('open'); }
function closeCatDropdown(){ document.getElementById('nav-cat-dropdown')?.classList.remove('open'); }
document.addEventListener('click', e=>{
  if(!document.getElementById('nav-cat-wrap')?.contains(e.target)) closeCatDropdown();
});

function populateCatDropdown(){
  const dd = document.getElementById('nav-cat-dropdown');
  if(!dd) return;
  dd.innerHTML = `<div class="nav-cat-item" onclick="goToCatalog()">Todos los productos</div>` +
    categorias.map(c=>`<div class="nav-cat-item" onclick="goToCatalog('${c.clave}')">${c.label}</div>`).join('');
}

function populateCatFilter(){
  const sel = document.getElementById('filter-cat');
  if(!sel) return;
  // Keep first option, add categories
  sel.innerHTML = '<option value="">Todas las categorías</option>' +
    categorias.map(c=>`<option value="${c.clave}">${c.label}</option>`).join('');
}

// Navigate to catalog page with optional category
function goToCatalog(cat=''){
  closeCatDropdown();
  const url = cat ? `catalogo.html?cat=${cat}` : 'catalogo.html';
  window.location.href = url;
}

// ── CAT GRID (index only) ──────────────────────────────────
function renderCatGrid(){
  const grid = document.getElementById('cat-grid');
  if(!grid) return;
  grid.innerHTML = categorias.map(c=>{
    const count = allProducts.filter(p=>p.categoria===c.clave).length;
    if(c.imagen_url){
      return `<div class="cat-card fade-in" onclick="goToCatalog('${c.clave}')">
        <div class="cat-card-img" style="background-image:url('${c.imagen_url}')"></div>
        <div class="cat-card-overlay"></div>
        <div class="cat-card-body"><div class="cat-card-name">${c.label}</div><div class="cat-card-count">${count} artículos</div></div>
      </div>`;
    }
    return `<div class="cat-card cat-card-no-img fade-in" onclick="goToCatalog('${c.clave}')">
      <div class="cat-card-placeholder">${getCatIcon(c.clave)}</div>
      <div class="cat-card-body"><div class="cat-card-name">${c.label}</div><div class="cat-card-count">${count} artículos</div></div>
    </div>`;
  }).join('');
}

// ── PRODUCTS ───────────────────────────────────────────────
function sortProducts(arr){
  const sort = document.getElementById('filter-sort')?.value||'az';
  const copy = [...arr];
  if(sort==='az')         copy.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  else if(sort==='za')    copy.sort((a,b)=>b.nombre.localeCompare(a.nombre));
  else if(sort==='price-asc')  copy.sort((a,b)=>a.precio-b.precio);
  else if(sort==='price-desc') copy.sort((a,b)=>b.precio-a.precio);
  return copy;
}

function filterProducts(){
  const q   = document.getElementById('prod-search')?.value.toLowerCase()||'';
  const cat = document.getElementById('filter-cat')?.value||'';
  prodPage  = 1;
  filteredProducts = sortProducts(allProducts.filter(p=>{
    const matchQ   = !q || p.nombre.toLowerCase().includes(q) || p.codigo.includes(q);
    const matchCat = !cat || p.categoria===cat;
    return matchQ && matchCat;
  }));
  renderProducts();
}

function renderProducts(){
  const grid  = document.getElementById('prod-grid');
  const count = document.getElementById('products-count');
  if(!grid) return;
  const total = filteredProducts.length;
  const pages = Math.ceil(total/PROD_PER_PAGE);
  const start = (prodPage-1)*PROD_PER_PAGE;
  const page  = filteredProducts.slice(start, start+PROD_PER_PAGE);
  if(count) count.textContent=`${total} producto${total!==1?'s':''} encontrado${total!==1?'s':''}`;
  if(!total){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-3)"><p style="font-size:18px">Sin resultados</p></div>';
    document.getElementById('pagination-wrap').style.display='none'; return;
  }
  grid.innerHTML = page.map((p,i)=>{
    const price  = applyMarkup(p.precio);
    const inCart = cart.find(c=>c.codigo===p.codigo);
    return `<div class="prod-card fade-in" style="animation-delay:${Math.min(i,12)*.04}s" onclick="openProdModal('${esc(p.codigo)}')">
      <div class="prod-card-img">
        ${p.imagen?`<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=prod-card-placeholder>${getCatIcon(p.categoria)}</span>'">`:`<span class="prod-card-placeholder">${getCatIcon(p.categoria)}</span>`}
      </div>
      <div class="prod-card-body">
        <div class="prod-card-codigo">COD. ${formatCodigo(p.codigo)}</div>
        <div class="prod-card-name">${esc(p.nombre)}</div>
        <div class="prod-card-price">${fmtPrice(price)}</div>
      </div>
      <div class="prod-card-footer">
        <button class="btn-detail" onclick="event.stopPropagation();openProdModal('${esc(p.codigo)}')">Ver detalle</button>
        <button class="btn-add ${inCart?'added':''}" id="add-btn-${esc(p.codigo)}" onclick="event.stopPropagation();addToCart('${esc(p.codigo)}')">
          ${inCart?`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg> Agregado`:`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar`}
        </button>
      </div>
    </div>`;
  }).join('');
  // Pagination
  if(pages>1){
    let btns=`<button class="page-btn" onclick="goPage(${prodPage-1})" ${prodPage===1?'disabled':''}>‹</button>`;
    for(let i=1;i<=pages;i++){
      if(i===1||i===pages||Math.abs(i-prodPage)<=2) btns+=`<button class="page-btn ${i===prodPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
      else if(Math.abs(i-prodPage)===3) btns+=`<span style="padding:0 4px;color:var(--text-3)">…</span>`;
    }
    btns+=`<button class="page-btn" onclick="goPage(${prodPage+1})" ${prodPage===pages?'disabled':''}>›</button>`;
    document.getElementById('pagination').innerHTML=btns;
    document.getElementById('pagination-wrap').style.display='flex';
  } else { document.getElementById('pagination-wrap').style.display='none'; }
}

function goPage(p){
  const pages=Math.ceil(filteredProducts.length/PROD_PER_PAGE);
  if(p<1||p>pages) return;
  prodPage=p; renderProducts();
  window.scrollTo({top:0,behavior:'smooth'});
}

// ── PRODUCT MODAL ──────────────────────────────────────────
function openProdModal(codigo){
  const p=allProducts.find(x=>x.codigo===codigo); if(!p) return;
  const price=applyMarkup(p.precio); const inCart=cart.find(c=>c.codigo===p.codigo);
  document.getElementById('modal-img').innerHTML=p.imagen?`<img src="${esc(p.imagen)}" alt="${esc(p.nombre)}" style="width:100%;height:100%;object-fit:contain">`:`<span class="prod-modal-placeholder">${getCatIcon(p.categoria)}</span>`;
  document.getElementById('modal-info').innerHTML=`
    <button class="prod-modal-close" onclick="closeProdModal()">✕</button>
    <div class="prod-modal-codigo">COD. ${formatCodigo(p.codigo)}</div>
    <div class="prod-modal-name">${esc(p.nombre)}</div>
    <div class="prod-modal-price">${fmtPrice(price)}</div>
    <div class="prod-modal-divider"></div>
    ${p.descripcion?`<div class="prod-modal-desc">${p.descripcion.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div>`:''}
    <div class="prod-modal-footer">
      <button class="btn-modal-add ${inCart?'added':''}" id="modal-add-btn" onclick="addToCart('${esc(p.codigo)}');this.classList.add('added');this.innerHTML='<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'20\\' height=\\'20\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg> Agregado'">
        ${inCart?`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg> Agregado`:`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg> Agregar al carrito`}
      </button>
    </div>`;
  document.getElementById('prod-modal-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeProdModal(e){
  if(e&&e.target!==document.getElementById('prod-modal-overlay')) return;
  document.getElementById('prod-modal-overlay').classList.remove('open');
  document.body.style.overflow='';
}

// ── CART ───────────────────────────────────────────────────
function loadCart(){
  try{ cart=JSON.parse(sessionStorage.getItem('mm_cart'))||[]; }catch{ cart=[]; }
  updateCartUI();
}
function saveCart(){ sessionStorage.setItem('mm_cart',JSON.stringify(cart)); updateCartUI(); }
function addToCart(codigo){
  const p=allProducts.find(x=>x.codigo===codigo); if(!p) return;
  const ex=cart.find(c=>c.codigo===codigo);
  if(ex) ex.qty++; else cart.push({codigo:p.codigo,nombre:p.nombre,precio:p.precio,imagen:p.imagen,categoria:p.categoria,qty:1});
  saveCart();
  const btn=document.getElementById(`add-btn-${codigo}`);
  if(btn){btn.classList.add('added');btn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg> Agregado`;}
}
function changeQty(codigo,delta){
  const item=cart.find(c=>c.codigo===codigo); if(!item) return;
  item.qty+=delta; if(item.qty<=0) cart=cart.filter(c=>c.codigo!==codigo);
  saveCart(); renderCartItems();
}
function updateCartUI(){
  const total=cart.reduce((s,i)=>s+i.qty,0);
  const badge=document.getElementById('cart-badge');
  if(badge){badge.textContent=total;badge.style.display=total>0?'flex':'none';}
}
function renderCartItems(){
  const el=document.getElementById('cart-items'); const tot=document.getElementById('cart-total');
  if(!cart.length){el.innerHTML=`<div class="cart-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg><p>Tu carrito está vacío</p></div>`;if(tot)tot.textContent='$0';return;}
  let subtotal=0;
  el.innerHTML=cart.map(item=>{
    const price=applyMarkup(item.precio); subtotal+=price*item.qty;
    return `<div class="cart-item">
      <div class="cart-item-img">${item.imagen?`<img src="${esc(item.imagen)}" onerror="this.style.display='none'">`:''}<span style="font-size:24px">${getCatIcon(item.categoria)}</span></div>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.nombre)}</div>
        <div class="cart-item-price">${fmtPrice(price)}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty('${esc(item.codigo)}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${esc(item.codigo)}',1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
  if(tot) tot.textContent=fmtPrice(subtotal);
}
function openCart(){ renderCartItems(); document.getElementById('cart-overlay').classList.add('open'); document.getElementById('cart-drawer').classList.add('open'); document.body.style.overflow='hidden'; }
function closeCart(){ document.getElementById('cart-overlay').classList.remove('open'); document.getElementById('cart-drawer').classList.remove('open'); document.body.style.overflow=''; }

// ── CHECKOUT ───────────────────────────────────────────────
function calcTotal(){ return cart.reduce((s,i)=>s+applyMarkup(i.precio)*i.qty,0); }
function calcConInteres(sub,plan){ if(!plan||plan.interes===0) return sub; return roundClean(sub*(1+plan.interes/100)); }
function cuotaValor(total,plan){ return plan&&plan.cuotas>1?roundClean(total/plan.cuotas):total; }

function openCheckout(){
  if(!cart.length) return;
  checkoutStep=1; planSeleccionado=planes[0]||{id:'contado',label:'Contado',cuotas:1,interes:0};
  closeCart(); renderCheckout();
  document.getElementById('checkout-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeCheckout(){ document.getElementById('checkout-overlay').classList.remove('open'); document.body.style.overflow=''; }

function renderCheckout(){
  const modal=document.getElementById('checkout-modal');
  if(checkoutStep===1) renderPlanesStep(modal);
  else if(checkoutStep===2) renderDatosStep(modal);
  else if(checkoutStep===3) renderResumenStep(modal);
  else renderSuccessStep(modal);
}

function renderPlanesStep(modal){
  const sub=calcTotal();
  const pl=planes.map(plan=>{
    const tot=calcConInteres(sub,plan); const cuota=cuotaValor(tot,plan); const sel=planSeleccionado?.id===plan.id;
    return `<div class="plan-item ${sel?'selected':''}" onclick="selectPlan('${plan.id}')">
      <div><div class="plan-label">${plan.label}</div><div class="plan-sub">${plan.interes===0?'Sin interés':'Con financiación'}</div></div>
      <div class="plan-cuota">${plan.cuotas>1?plan.cuotas+' × '+fmtPrice(cuota):fmtPrice(cuota)}</div>
      <div class="plan-check">${sel?'✓':''}</div>
    </div>`;
  }).join('');
  modal.innerHTML=`<div class="checkout-header"><div><div class="checkout-step-title">Plan de pago</div><div class="checkout-step-sub">Paso 1 de 3</div></div><button onclick="closeCheckout()" style="width:36px;height:36px;background:var(--off-white);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--text-3);border:none;cursor:pointer">✕</button></div>
    <div class="checkout-body"><div class="step-indicator"><div class="step-dot active"></div><div class="step-dot"></div><div class="step-dot"></div></div>
    <div class="planes-list">${pl}</div><div class="planes-disclaimer">⚠️ El monto mensual es estimativo, consulte con su vendedor.</div></div>
    <div class="checkout-footer"><button class="btn-secondary" onclick="closeCheckout()">Cancelar</button><button class="btn-primary" onclick="checkoutStep=2;renderCheckout()">Siguiente <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></div>`;
}
function selectPlan(id){ planSeleccionado=planes.find(p=>p.id===id)||planes[0]; renderCheckout(); }

function renderDatosStep(modal){
  modal.innerHTML=`<div class="checkout-header"><div><div class="checkout-step-title">Tus datos</div><div class="checkout-step-sub">Paso 2 de 3</div></div><button onclick="closeCheckout()" style="width:36px;height:36px;background:var(--off-white);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--text-3);border:none;cursor:pointer">✕</button></div>
    <div class="checkout-body"><div class="step-indicator"><div class="step-dot done"></div><div class="step-dot active"></div><div class="step-dot"></div></div>
    <div class="form-row"><div class="form-group"><label>Nombre</label><input id="c-nombre" placeholder="Tu nombre" autocomplete="given-name"/></div><div class="form-group"><label>Apellido</label><input id="c-apellido" placeholder="Tu apellido" autocomplete="family-name"/></div></div>
    <div class="form-group"><label>Teléfono</label><input id="c-tel" type="tel" placeholder="Tu número de contacto" autocomplete="tel"/></div>
    <div class="form-group"><label>Observaciones (opcional)</label><textarea id="c-obs" placeholder="Cualquier detalle adicional…"></textarea></div></div>
    <div class="checkout-footer"><button class="btn-secondary" onclick="checkoutStep=1;renderCheckout()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button><button class="btn-primary" onclick="validateDatos()">Ver resumen <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button></div>`;
}
function validateDatos(){
  const nombre=document.getElementById('c-nombre')?.value.trim();
  const apellido=document.getElementById('c-apellido')?.value.trim();
  const tel=document.getElementById('c-tel')?.value.trim();
  if(!nombre||!apellido){alert('Por favor ingresá nombre y apellido.');return;}
  if(!tel){alert('Por favor ingresá tu teléfono.');return;}
  checkoutStep=3;renderCheckout();
}

function renderResumenStep(modal){
  const nombre=(document.getElementById('c-nombre')?.value.trim()||'')+' '+(document.getElementById('c-apellido')?.value.trim()||'');
  const tel=document.getElementById('c-tel')?.value.trim()||'';
  const obs=document.getElementById('c-obs')?.value.trim()||'';
  const sub=calcTotal(); const total=calcConInteres(sub,planSeleccionado); const cuota=cuotaValor(total,planSeleccionado);
  const planTxt=planSeleccionado?(planSeleccionado.cuotas===1?'Contado':`${planSeleccionado.cuotas} cuotas de ${fmtPrice(cuota)}`):'Contado';
  const itemsHTML=cart.map(item=>`<div class="resumen-item"><div class="resumen-item-name">${esc(item.nombre)}</div><div class="resumen-item-qty">x${item.qty}</div><div class="resumen-item-price">${fmtPrice(applyMarkup(item.precio)*item.qty)}</div></div>`).join('');
  modal.innerHTML=`<div class="checkout-header"><div><div class="checkout-step-title">Confirmación</div><div class="checkout-step-sub">Paso 3 de 3</div></div><button onclick="closeCheckout()" style="width:36px;height:36px;background:var(--off-white);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--text-3);border:none;cursor:pointer">✕</button></div>
    <div class="checkout-body"><div class="step-indicator"><div class="step-dot done"></div><div class="step-dot done"></div><div class="step-dot active"></div></div>
    <div class="resumen-cliente"><div class="resumen-cliente-name">${esc(nombre.trim())}</div><div class="resumen-cliente-tel">Tel: ${esc(tel)}</div>${obs?`<div class="resumen-cliente-tel" style="margin-top:4px">Obs: ${esc(obs)}</div>`:''}</div>
    <div class="resumen-plan">${planTxt}</div>
    <div class="resumen-items">${itemsHTML}</div>
    <div class="resumen-total"><span class="resumen-total-label">Total estimado</span><span class="resumen-total-val">${fmtPrice(total)}</span></div></div>
    <div class="checkout-footer"><button class="btn-secondary" onclick="checkoutStep=2;renderCheckout()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Volver</button>
    <button class="btn-enviar" id="btn-enviar" onclick="enviarPresupuesto()"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Enviar presupuesto</button></div>`;
}

async function enviarPresupuesto(){
  const nombre=(document.getElementById('c-nombre')?.value.trim()||'')+' '+(document.getElementById('c-apellido')?.value.trim()||'');
  const tel=document.getElementById('c-tel')?.value.trim()||'';
  const obs=document.getElementById('c-obs')?.value.trim()||'';
  const sub=calcTotal(); const total=calcConInteres(sub,planSeleccionado); const cuota=cuotaValor(total,planSeleccionado);
  const planTxt=planSeleccionado?(planSeleccionado.cuotas===1?'Contado':`${planSeleccionado.cuotas} cuotas de ${fmtPrice(cuota)} (Total: ${fmtPrice(total)})`):'Contado';
  const payload={cliente:nombre.trim(),telefono:tel,plan:planTxt,observaciones:obs,items:cart.map(i=>({nombre:i.nombre,codigo:formatCodigo(i.codigo),precio:fmtPrice(applyMarkup(i.precio)),qty:i.qty}))};
  const btn=document.getElementById('btn-enviar');
  if(btn){btn.disabled=true;btn.textContent='Enviando…';}
  try{ await fetch(SERVIDOR_URL+'/presupuesto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); }catch(e){ console.log(e); }
  checkoutStep=4; renderCheckout();
}

function renderSuccessStep(modal){
  cart=[]; saveCart();
  modal.innerHTML=`<div class="success-screen">
    <div class="success-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    <div class="success-title">¡Presupuesto enviado!</div>
    <div class="success-sub">Un vendedor se contactará con vos a la brevedad.<br/>¡Gracias por tu consulta!</div>
    <button class="btn-primary" style="margin:32px auto 0;justify-content:center" onclick="closeCheckout()">Volver al catálogo</button>
  </div>`;
}

// ── SHARED CART/MODAL HTML ─────────────────────────────────
function injectSharedHTML(){
  const cartOverlay = document.getElementById('cart-overlay');
  if(!cartOverlay){
    document.body.insertAdjacentHTML('beforeend',`
      <!-- PRODUCT MODAL -->
      <div class="modal-overlay" id="prod-modal-overlay" onclick="closeProdModal(event)">
        <div class="prod-modal" style="position:relative">
          <div class="prod-modal-img" id="modal-img"></div>
          <div class="prod-modal-info" id="modal-info"></div>
        </div>
      </div>
      <!-- CART -->
      <div class="cart-overlay" id="cart-overlay" onclick="closeCart()"></div>
      <div class="cart-drawer" id="cart-drawer">
        <div class="cart-drawer-header">
          <div class="cart-drawer-title">Mi carrito</div>
          <button class="cart-drawer-close" onclick="closeCart()">✕</button>
        </div>
        <div class="cart-items" id="cart-items"></div>
        <div class="cart-drawer-footer">
          <div class="cart-total-row"><span class="cart-total-label">Total estimado</span><span class="cart-total-val" id="cart-total">$0</span></div>
          <button class="btn-checkout" onclick="openCheckout()">Solicitar presupuesto <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
        </div>
      </div>
      <!-- CHECKOUT -->
      <div class="checkout-overlay" id="checkout-overlay">
        <div class="checkout-modal" id="checkout-modal"></div>
      </div>
    `);
  }
}

// ── INIT ───────────────────────────────────────────────────
async function initShared(){
  injectSharedHTML();
  loadCart();
  await Promise.all([loadCategorias(), loadProductos(), loadPlanes()]);
  if(typeof injectWebChat === "function") injectWebChat();
}

// ══════════════════════════════════════
// CHAT IA — WEB
// ══════════════════════════════════════
let webChatHistory = [];
let webChatOpen = false;

function injectWebChat() {
  document.body.insertAdjacentHTML('beforeend', `
    <!-- IA BUBBLE -->
    <div id="ia-bubble-web" style="position:fixed;bottom:100px;right:24px;z-index:300;display:flex;flex-direction:column;align-items:flex-end;gap:8px;animation:fadeInUp .4s ease">
      <div style="background:var(--blue);color:#fff;font-size:13px;font-weight:600;padding:10px 16px;box-shadow:var(--shadow-md);max-width:200px;text-align:center;line-height:1.4">
        ¿Necesitás ayuda?
        <div style="position:absolute;bottom:-8px;right:20px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:9px solid var(--blue)"></div>
      </div>
    </div>
    <!-- IA FLOAT BUTTON -->
    <button id="ia-float-btn" onclick="toggleWebChat()" style="position:fixed;bottom:24px;right:24px;z-index:301;width:56px;height:56px;border-radius:50%;background:var(--blue);color:#fff;box-shadow:var(--shadow-lg);display:flex;align-items:center;justify-content:center;transition:background .15s,transform .15s;border:none;cursor:pointer">
      <svg id="ia-float-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    </button>
    <!-- CHAT PANEL -->
    <div id="web-chat-panel" class="web-chat-panel" style="display:none;flex-direction:column">
      <div style="background:var(--blue);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <div>
            <div style="font-size:15px;font-weight:700">Asistente MM</div>
            <div style="font-size:11px;opacity:.75">Powered by IA</div>
          </div>
        </div>
        <button onclick="toggleWebChat()" style="width:28px;height:28px;background:rgba(255,255,255,.15);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;border-radius:50%">✕</button>
      </div>
      <div id="web-chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--off-white)">
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px">
          <div style="max-width:85%;padding:10px 14px;background:var(--white);border:1.5px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-1)">
            ¡Hola! Soy el asistente de Muñoz Marchesi. ¿En qué puedo ayudarte hoy?
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:12px 16px;background:var(--white);border-top:1.5px solid var(--border);flex-shrink:0">
        <input id="web-chat-input" placeholder="Escribí tu consulta…" onkeydown="if(event.key==='Enter')sendWebChat()" style="flex:1;height:38px;padding:0 12px;border:1.5px solid var(--border);background:var(--off-white);font-size:13px;outline:none;font-family:inherit"/>
        <button onclick="sendWebChat()" style="width:38px;height:38px;background:var(--blue);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
    <style>
    @keyframes typingDot{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}
    @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    #ia-float-btn:hover{background:var(--blue-dark);transform:scale(1.05)}
    #web-chat-input:focus{border-color:var(--blue)}
    .web-chat-panel{
      position:fixed;bottom:92px;right:24px;z-index:300;
      width:480px;
      height:min(740px, calc(100vh - 72px - 108px));
      background:var(--white);box-shadow:var(--shadow-lg);
      border:1.5px solid var(--border);
      animation:fadeInUp .3s ease;
    }
    @media(max-width:520px){
      .web-chat-panel{
        position:fixed;
        left:0;right:0;bottom:80px;
        width:100%;
        height:70vh;
        border-left:none;border-right:none;
        border-radius:0;
      }
      #ia-float-btn{right:16px;bottom:16px}
      #ia-bubble-web{right:16px;bottom:82px}
    }
    </style>
  `);

  // Hide bubble after 5s
  setTimeout(() => {
    const b = document.getElementById('ia-bubble-web');
    if(b) b.style.display = 'none';
  }, 5000);
}

function toggleWebChat() {
  webChatOpen = !webChatOpen;
  const panel = document.getElementById('web-chat-panel');
  const bubble = document.getElementById('ia-bubble-web');
  if(webChatOpen) {
    panel.style.display = 'flex';
    if(bubble) bubble.style.display = 'none';
    setTimeout(()=>document.getElementById('web-chat-input')?.focus(), 100);
  } else {
    panel.style.display = 'none';
  }
}

async function sendWebChat() {
  const input = document.getElementById('web-chat-input');
  const msg = input?.value.trim();
  if(!msg) return;
  input.value = '';

  appendWebMsg(msg, 'user');
  webChatHistory.push({ role:'user', content: msg });

  const typingEl = appendWebTyping();

  try {
    const productos = allProducts.map(p => ({
      codigo: p.codigo, nombre: p.nombre,
      precio: Math.round(p.precio * 1.05),
      categoria: p.categoria,
    }));

    const res = await fetch(SERVIDOR_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: webChatHistory, productos }),
    });
    const data = await res.json();
    typingEl?.remove();

    if(data.ok) {
      const cleanText = data.text.replace(/\[COD:[^\]]+\]/g, '').trim();
      appendWebMsg(cleanText, 'ai');
      webChatHistory.push({ role:'assistant', content: data.text });
      if(data.productosRecomendados?.length) {
        data.productosRecomendados.forEach(p => appendWebProduct(p));
      }
    } else {
      appendWebMsg('Hubo un error. Intentá de nuevo.', 'ai');
    }
  } catch(e) {
    typingEl?.remove();
    appendWebMsg('No pude conectarme. Verificá tu conexión.', 'ai');
  }
}

function renderChatText(text) {
  // Support **bold** and newlines
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
function appendWebMsg(text, role) {
  const container = document.getElementById('web-chat-messages');
  if(!container) return;
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isUser?'flex-end':'flex-start'};gap:4px`;
  div.innerHTML = `<div style="max-width:85%;padding:10px 14px;background:${isUser?'var(--blue)':'var(--white)'};color:${isUser?'#fff':'var(--text-1)'};${isUser?'':'border:1.5px solid var(--border);'}font-size:13px;line-height:1.5;white-space:pre-line">${renderChatText(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendWebTyping() {
  const container = document.getElementById('web-chat-messages');
  if(!container) return null;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:flex-start';
  div.innerHTML = `<div style="padding:10px 14px;background:var(--white);border:1.5px solid var(--border);display:flex;gap:4px;align-items:center">
    <span style="width:6px;height:6px;border-radius:50%;background:var(--text-3);animation:typingDot 1.2s ease infinite;display:block"></span>
    <span style="width:6px;height:6px;border-radius:50%;background:var(--text-3);animation:typingDot 1.2s ease .2s infinite;display:block"></span>
    <span style="width:6px;height:6px;border-radius:50%;background:var(--text-3);animation:typingDot 1.2s ease .4s infinite;display:block"></span>
  </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendWebProduct(p) {
  const container = document.getElementById('web-chat-messages');
  if(!container) return;
  const prod = allProducts.find(x => String(x.codigo) === String(p.codigo));
  const price = prod ? roundClean(prod.precio * PRICE_MARKUP) : Math.round(p.precio || 0);
  div.style.cssText = 'display:flex;align-items:flex-start';
  div.innerHTML = `<div onclick="openProdModal('${esc(String(p.codigo))}')" style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--white);border:1.5px solid var(--border);cursor:pointer;max-width:90%;transition:border-color .15s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'">
    <div style="width:48px;height:48px;flex-shrink:0;background:var(--off-white);display:flex;align-items:center;justify-content:center;overflow:hidden">
      ${p.imagen_url?`<img src="${esc(p.imagen_url)}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'"/>`:'<span style="font-size:20px">📦</span>'}
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;color:var(--text-1);line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(p.nombre)}</div>
      <div style="font-size:14px;font-weight:800;color:var(--blue);margin-top:2px">$${price.toLocaleString('es-AR')}</div>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-3)" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
