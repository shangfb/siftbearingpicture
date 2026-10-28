// @vitest-environment happy-dom
import {it,expect,vi} from 'vitest';
vi.mock('../src/supabase',()=>({supabase:null,configured:false,configurationError:''}));
it('unconfigured live admin shows setup, never sample or unauthenticated edit controls',async()=>{
 document.body.innerHTML='<div id="app"></div>';
 await import('../src/live-admin');
 expect(document.body.textContent).toContain('连接您的 Supabase');
 expect(document.querySelector('#new')).toBeNull();
 expect(document.querySelector('#login-form')).toBeNull();
 expect(document.querySelector('a[href="/admin-demo/"]')).not.toBeNull();
});
