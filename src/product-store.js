import { supabase } from './supabase';
const bucket='sift-product-images';
const check=({data,error})=>{if(error)throw error;return data};
export async function assertAdmin(){const user=check(await supabase.auth.getUser())?.user;if(!user)throw Error('请先登录。');if(!check(await supabase.rpc('sift_is_admin')))throw Error('此账号没有管理员权限。');return user;}
export async function loadProducts(){
  const rows=check(await supabase.from('sift_products').select('*,sift_product_images(*)').order('updated_at',{ascending:false}).limit(500));
  return Promise.all(rows.map(async p=>({...p,images:await Promise.all(p.sift_product_images.sort((a,b)=>a.position-b.position).map(async i=>{const result=await supabase.storage.from(bucket).createSignedUrl(i.object_path,900);return {...i,url:result.data?.signedUrl||'',imageError:!!result.error}}))})));
}
export function validatePhoto(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('仅支持 JPG、PNG、WebP。');if(file.size>10*1024*1024)throw Error('每张图片不能超过 10 MB。');}
export async function saveProduct(fields,images){
  await assertAdmin();
  if(!fields.brand.trim()||!fields.model.trim())throw Error('品牌和完整型号不能为空。');
  if(images.length>30)throw Error('每款产品最多 30 张图片。');
  if(fields.status==='published'&&!images.length)throw Error('发布前至少添加一张图片。');
  const id=fields.id||crypto.randomUUID();
  if(!fields.id){
    // Stage as private draft. A failed upload leaves a recoverable draft, never a partial public product.
    const slug=[fields.brand,fields.model].join('-').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,170)||'bearing';
    check(await supabase.from('sift_products').insert({id,brand:fields.brand.trim(),model:fields.model.trim(),slug:`${slug}-${id.slice(0,8)}`,status:'draft'}));
  }
  try {
    const metadata=[];
    for(const image of images){
      if(image.file){
        validatePhoto(image.file);
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[image.file.type];
        const imageId=crypto.randomUUID(),path=`${id}/${imageId}.${ext}`;
        check(await supabase.storage.from(bucket).upload(path,image.file,{contentType:image.file.type,upsert:false}));
        metadata.push({id:imageId,object_path:path,alt_en:'',alt_es:''});
      }else metadata.push({id:image.id,object_path:image.object_path,alt_en:image.alt_en||'',alt_es:image.alt_es||''});
    }
    check(await supabase.rpc('sift_save_product',{p_product:{...fields,id},p_images:metadata}));
    // Removed objects are intentionally NOT deleted here: another session may still reference them.
    // Metadata removal immediately revokes new anonymous signed URL creation. Orphan cleanup is a later admin job.
    return id;
  } catch(error){
    // Keep uploaded objects on ambiguous network failure: RPC might have committed.
    // Reload before retrying. Deleting here could break successfully committed image references.
    error.stagedProductId=id;
    throw error;
  }
}
export async function setProductStatus(product,status){return saveProduct({...product,status},product.images);}
