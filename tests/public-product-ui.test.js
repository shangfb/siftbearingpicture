// @vitest-environment happy-dom
import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({listPublishedProducts:vi.fn()}));
vi.mock('../src/visitor-products',()=>m);
import {mountPublicProducts} from '../src/public-product-ui';
beforeEach(()=>{document.body.innerHTML='<section id="products"><div class="product-grid">old demo</div></section>';vi.clearAllMocks()});
it('shows an honest empty state rather than demo products',async()=>{m.listPublishedProducts.mockResolvedValue([]);await mountPublicProducts();expect(document.body.textContent).toContain('being prepared');expect(document.body.textContent).not.toContain('old demo')});
it('shows retry when loading fails',async()=>{m.listPublishedProducts.mockRejectedValue(Error('offline'));await mountPublicProducts(true);expect(document.querySelector('#retry-products')).not.toBeNull();expect(document.body.textContent).toContain('temporalmente')});
it('escapes user-entered model and brand',async()=>{m.listPublishedProducts.mockResolvedValue([{model:'<script>bad()</script>',brand:'<img src=x onerror=bad()>',images:[]}]);await mountPublicProducts();expect(document.querySelector('script')).toBeNull();expect(document.querySelector('[onerror]')).toBeNull();expect(document.body.textContent).toContain('<script>bad()</script>')});
