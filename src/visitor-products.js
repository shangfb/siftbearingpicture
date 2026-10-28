import {visitorClient} from './supabase';
const unwrap=({data,error})=>{if(error)throw error;return data};
export async function listPublishedProducts(){
  if(!visitorClient)throw Error('Public product connection is not configured.');
  const products=unwrap(await visitorClient.from('sift_products')
    .select('id,brand,model,slug,bearing_type,description_en,description_es,status,sift_product_images(id,object_path,position,alt_en,alt_es)')
    .eq('status','published').order('updated_at',{ascending:false}).limit(9));
  // Defense in depth; the database RLS must also deny unpublished data.
  return Promise.all(products.filter(p=>p.status==='published').map(async p=>({...p,
    images:await Promise.all(p.sift_product_images.sort((a,b)=>a.position-b.position).map(async image=>{
      const data=unwrap(await visitorClient.storage.from('sift-product-images').createSignedUrl(image.object_path,300));
      if(!data?.signedUrl)throw Error('Missing product image URL');
      return {...image,url:data.signedUrl};
    })),
  })));
}

// Read-only live checks against administrator-known private product IDs/paths.
// Network/server failures are inconclusive, never counted as successful denials.
export async function checkVisitorIsolation(products){
  if(!visitorClient)throw Error('未配置访客连接。');
  const results=[];
  try {
    const value=unwrap(await visitorClient.rpc('sift_is_admin'));
    results.push({label:'访客不具备管理员身份',state:value===false?'pass':'fail'});
  }catch{results.push({label:'访客管理员身份检查',state:'unknown'});}
  const privateProducts=products.filter(p=>p.status!=='published').slice(0,10);
  if(!privateProducts.length){results.push({label:'暂无草稿或下架产品可用于验证',state:'skip'});return results;}
  for(const p of privateProducts){
    const label=`${p.brand} ${p.model}`;
    try {
      const data=unwrap(await visitorClient.from('sift_products').select('id').eq('id',p.id));
      results.push({label:`${label}：访客无法读取产品`,state:Array.isArray(data)&&data.length===0?'pass':'fail'});
    }catch{results.push({label:`${label}：产品读取检查`,state:'unknown'});}
    try {
      const data=unwrap(await visitorClient.from('sift_product_images').select('id').eq('product_id',p.id));
      results.push({label:`${label}：访客无法读取图片记录`,state:Array.isArray(data)&&data.length===0?'pass':'fail'});
    }catch{results.push({label:`${label}：图片记录检查`,state:'unknown'});}
    for(const image of (p.images||[]).slice(0,30)){
      try{
        const {data,error}=await visitorClient.storage.from('sift-product-images').createSignedUrl(image.object_path,30);
        // Supabase private-object denial is commonly 400/404; only classify a known denial message.
        const denied=error && /not found|does not exist|row.level|permission|unauthorized|access denied/i.test(error.message||'');
        results.push({label:`${label}：原图 ${image.position+1} 无法生成访客链接`,state:data?.signedUrl?'fail':denied?'pass':'unknown'});
      }catch{results.push({label:`${label}：原图链接检查`,state:'unknown'});}
    }
  }
  return results;
}
