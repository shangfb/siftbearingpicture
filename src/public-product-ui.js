import {listPublishedProducts} from './visitor-products';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountPublicProducts(es=false){
 const grid=document.querySelector('#products .product-grid');if(!grid)return;
 const t=(en,sp)=>es?sp:en;
 grid.setAttribute('aria-live','polite');
 grid.innerHTML=`<p class="catalog-message">${t('Loading published products…','Cargando productos publicados…')}</p>`;
 try{
  const products=await listPublishedProducts();
  if(!products.length){grid.innerHTML=`<div class="catalog-message"><h3>${t('Tell us what you need.','Díganos qué necesita.')}</h3><p>${t('Our product selection is being prepared. Send your brand, full part number and quantity to check supply options.','Estamos preparando nuestra selección de productos. Envíenos la marca, referencia completa y cantidad para consultar opciones de suministro.')}</p><a class="button" href="#inquiry">${t('Send your bearing list','Envíe su lista')} ↗</a></div>`;return;}
  grid.innerHTML=products.map((p,n)=>`<button class="product-card" data-live-product="${n}"><div class="product-photo"><span class="pill">${escape(p.brand)}</span>${p.images[0]?`<img style="object-fit:contain" src="${escape(p.images[0].url)}" alt="${escape(es?p.images[0].alt_es||`${p.brand} ${p.model} — foto real`:p.images[0].alt_en||`${p.brand} ${p.model} — actual photo`)}" loading="lazy" width="600" height="600">`:`<span class="catalog-message">${t('Photo available on request','Foto disponible bajo solicitud')}</span>`}<span class="expand">↗</span></div><div class="product-info"><span>${t('Bearing sourcing','Suministro de rodamientos')}</span><h3>${escape(p.model)}</h3><div>${t('View actual photos','Ver fotos reales')} <span>→</span></div></div></button>`).join('');
  grid.querySelectorAll('[data-live-product]').forEach(b=>b.onclick=()=>openProduct(products[+b.dataset.liveProduct],es));
 }catch{
  grid.innerHTML=`<div class="catalog-message" role="status"><h3>${t('Products are temporarily unavailable.','Productos temporalmente no disponibles.')}</h3><p>${t('You can still send your purchasing list by email or WhatsApp.','Puede enviarnos su lista por correo o WhatsApp.')}</p><button class="button" id="retry-products">${t('Try again','Reintentar')} ↗</button></div>`;
  document.querySelector('#retry-products').onclick=()=>mountPublicProducts(es);
 }
}
function openProduct(product,es){
 const t=(en,sp)=>es?sp:en,dialog=document.querySelector('#product-dialog'),content=document.querySelector('#dialog-content');
 const description=es?product.description_es:product.description_en;
 content.innerHTML=`<div class="live-gallery">${product.images[0]?`<img id="live-product-image" src="${escape(product.images[0].url)}" alt="${escape(product.brand+' '+product.model)}">`:''}<div class="live-thumbnails">${product.images.map((i,n)=>`<button type="button" data-photo="${n}" aria-label="${t('Photo','Foto')} ${n+1}" aria-pressed="${n===0}"><img src="${escape(i.url)}" alt="${t('Photo','Foto')} ${n+1}"></button>`).join('')}</div></div><div><div class="eyebrow">${escape(product.brand)}</div><h2>${escape(product.model)}</h2>${description?`<p style="white-space:pre-wrap">${escape(description)}</p>`:''}<p>${t('Actual photos from previously handled products. Please inquire to confirm specifications, current availability and dispatch timing.','Fotos reales de productos gestionados anteriormente. Consulte las especificaciones, disponibilidad actual y plazos de envío.')}</p><a class="button" id="ask-live-product" href="#inquiry">${t('Inquire about this model','Consultar este modelo')} ↗</a></div>`;
 content.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{const image=product.images[+b.dataset.photo];document.querySelector('#live-product-image').src=image.url;content.querySelectorAll('[data-photo]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
 document.querySelector('#ask-live-product').onclick=()=>{document.querySelector('textarea[name="requirements"]').value=`${product.brand} / ${product.model} / `;dialog.close()};
 dialog.showModal();
}
