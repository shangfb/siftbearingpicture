import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks=vi.hoisted(()=>({auth:{getUser:vi.fn()},rpc:vi.fn(),from:vi.fn(),storage:{from:vi.fn()}}));
vi.mock('../src/supabase',()=>({supabase:mocks}));
import {assertAdmin,saveProduct,validatePhoto} from '../src/product-store';
let insert,upload;
beforeEach(()=>{vi.clearAllMocks();mocks.auth.getUser.mockResolvedValue({data:{user:{id:'user-id'}}});mocks.rpc.mockImplementation(async(name)=>({data:name==='sift_is_admin'?true:'product-id',error:null}));insert=vi.fn().mockResolvedValue({error:null});upload=vi.fn().mockResolvedValue({error:null});mocks.from.mockReturnValue({insert});mocks.storage.from.mockReturnValue({upload});});
describe('product persistence boundary',()=>{
 it('denies an ordinary authenticated account',async()=>{mocks.rpc.mockResolvedValue({data:false});await expect(assertAdmin()).rejects.toThrow('没有管理员');});
 it('denies missing authentication',async()=>{mocks.auth.getUser.mockResolvedValue({data:{user:null}});await expect(assertAdmin()).rejects.toThrow('先登录');});
 it('rejects unsupported/oversized images',()=>{expect(()=>validatePhoto({type:'image/svg+xml',size:1})).toThrow();expect(()=>validatePhoto({type:'image/png',size:10485761})).toThrow();});
 it('does not publish without an image',async()=>{await expect(saveProduct({brand:'NSK',model:'6205',status:'published'},[])).rejects.toThrow('至少');expect(insert).not.toHaveBeenCalled()});
 it('creates a private draft first, then saves metadata atomically',async()=>{await saveProduct({brand:' NSK ',model:'6205',status:'published'},[{file:{type:'image/png',size:20}}]);expect(insert.mock.calls[0][0]).toMatchObject({status:'draft',brand:'NSK'});expect(upload).toHaveBeenCalledOnce();const call=mocks.rpc.mock.calls.find(c=>c[0]==='sift_save_product');expect(call[1].p_images).toHaveLength(1);expect(call[1].p_product.status).toBe('published');});
 it('does not commit metadata after failed upload',async()=>{upload.mockResolvedValue({error:new Error('upload failed')});await expect(saveProduct({brand:'NSK',model:'6205',status:'draft'},[{file:{type:'image/png',size:20}}])).rejects.toThrow('upload failed');expect(mocks.rpc.mock.calls.some(c=>c[0]==='sift_save_product')).toBe(false)});
 it('retains existing object identifiers and image order',async()=>{await saveProduct({id:'existing',brand:'INA',model:'SL',status:'draft'},[{id:'second',object_path:'existing/second.jpg'},{id:'first',object_path:'existing/first.jpg'}]);expect(insert).not.toHaveBeenCalled();expect(upload).not.toHaveBeenCalled();const call=mocks.rpc.mock.calls.find(c=>c[0]==='sift_save_product');expect(call[1].p_images.map(i=>i.id)).toEqual(['second','first']);});
});
