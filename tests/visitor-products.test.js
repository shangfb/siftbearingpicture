import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),storage:{from:vi.fn()}}));
vi.mock('../src/supabase',()=>({visitorClient:m}));
import {checkVisitorIsolation,listPublishedProducts} from '../src/visitor-products';
let sign,chain;
beforeEach(()=>{vi.clearAllMocks();m.rpc.mockResolvedValue({data:false});chain={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn()};chain.select.mockReturnValue(chain);chain.eq.mockReturnValue(chain);chain.order.mockReturnValue(chain);chain.limit.mockResolvedValue({data:[]});m.from.mockReturnValue(chain);sign=vi.fn().mockResolvedValue({data:null,error:{message:'Object not found'}});m.storage.from.mockReturnValue({createSignedUrl:sign});});
describe('anonymous published feed',()=>{
 it('explicitly filters to published and returns an empty library, not demo data',async()=>{expect(await listPublishedProducts()).toEqual([]);expect(chain.eq).toHaveBeenCalledWith('status','published');});
 it('fails closed on a database error',async()=>{chain.limit.mockResolvedValue({error:Error('offline')});await expect(listPublishedProducts()).rejects.toThrow('offline');});
 it('filters unexpected private rows and orders cover images',async()=>{chain.limit.mockResolvedValue({data:[{id:'private',status:'draft',sift_product_images:[]},{id:'public',status:'published',sift_product_images:[{position:1,object_path:'b'},{position:0,object_path:'a'}]}]});sign.mockResolvedValue({data:{signedUrl:'https://example.test/image'}});const items=await listPublishedProducts();expect(items).toHaveLength(1);expect(items[0].images.map(i=>i.object_path)).toEqual(['a','b']);});
});
describe('read-only isolation checks',()=>{
 const products=[{id:'private',brand:'NSK',model:'6205',status:'draft',images:[{position:0,object_path:'private/photo.jpg'}]}];
 it('checks hidden private rows and rejects signing without executing writes',async()=>{chain.eq.mockResolvedValue({data:[]});const result=await checkVisitorIsolation(products);expect(result.every(r=>r.state==='pass')).toBe(true);expect(sign).toHaveBeenCalled();expect(m.rpc).toHaveBeenCalledExactlyOnceWith('sift_is_admin');});
 it('flags exposed draft records and successful draft signing as failures',async()=>{chain.eq.mockResolvedValue({data:[{id:'private'}]});sign.mockResolvedValue({data:{signedUrl:'https://example.test/unsafe'}});const result=await checkVisitorIsolation(products);expect(result.filter(r=>r.state==='fail')).toHaveLength(3);});
 it('never treats network errors as a successful denial',async()=>{m.rpc.mockRejectedValue(Error('offline'));chain.eq.mockResolvedValue({error:Error('network')});sign.mockRejectedValue(Error('Failed to fetch'));const result=await checkVisitorIsolation(products);expect(result.every(r=>r.state==='unknown')).toBe(true)});
});
