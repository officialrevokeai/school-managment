// @ts-check
/** @typedef {{code:string,message:string,requestId?:string}} ApiError */
const cloneApiData=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
class SchoolApi {
  /** @type {string} */ csrf = '';
  cache = new Map();
  pending = new Map();
  generation = 0;
  invalidate(){this.cache.clear();this.generation++;}
  /** @template T @param {string} path @param {string} [method] @param {unknown} [body] @returns {Promise<T>} */
  async request(path,method='GET',body) {
    const get=method==='GET',generation=this.generation,cacheable=get&&!/^(auth\/|context(?:\?|$)|platform\/security)/.test(path);
    if(!get)this.invalidate();
    const cached=this.cache.get(path);
    if(cacheable&&cached?.expires>Date.now())return cloneApiData(cached.value);
    const pending=this.pending.get(path);
    if(get&&pending?.generation===generation)return cloneApiData(await pending.promise);
    const run=async()=>{
    const response=await fetch('/api/v1/'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':this.csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const json=await response.json();
    if(!response.ok){if([401,403].includes(response.status))this.invalidate();const e=new Error(json.error?.message||'Request failed.');Object.assign(e,{code:json.error?.code,status:response.status});throw e;}
    if(cacheable&&generation===this.generation&&JSON.stringify(json).length<=250000){if(this.cache.size>=32)this.cache.delete(this.cache.keys().next().value);this.cache.set(path,{expires:Date.now()+10000,value:cloneApiData(json)});}
    if(!get){this.invalidate();if(/^auth\/(login|logout)$/.test(path)){try{localStorage.setItem('school-session-epoch',String(Date.now())+Math.random());}catch{}}}
    return json;
    };
    const promise=run();
    if(get)this.pending.set(path,{generation,promise});
    try{return cloneApiData(await promise);}finally{if(this.pending.get(path)?.promise===promise)this.pending.delete(path);}
  }
}
const api=new SchoolApi();
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initials(name=''){return name.split(/\s+/).slice(0,2).map(n=>n[0]||'').join('');}
function date(value){return value?new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:typeof context!=='undefined'&&context?.organization?.timezone||'Asia/Kolkata'}).format(new Date(value)):'—';}
function money(value){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format((value||0)/100);}
