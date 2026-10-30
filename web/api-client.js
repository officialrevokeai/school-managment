// @ts-check
/** @typedef {{code:string,message:string,requestId?:string}} ApiError */
class SchoolApi {
  /** @type {string} */ csrf = '';
  /** @template T @param {string} path @param {string} [method] @param {unknown} [body] @returns {Promise<T>} */
  async request(path,method='GET',body) {
    const response=await fetch('/api/v1/'+path,{method,credentials:'same-origin',headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':this.csrf}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
    const json=await response.json();
    if(!response.ok){const e=new Error(json.error?.message||'Request failed.');Object.assign(e,{code:json.error?.code,status:response.status});throw e;}
    return json;
  }
}
const api=new SchoolApi();
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initials(name=''){return name.split(/\s+/).slice(0,2).map(n=>n[0]||'').join('');}
function date(value){return value?new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:typeof context!=='undefined'&&context?.organization?.timezone||'Asia/Kolkata'}).format(new Date(value)):'—';}
function money(value){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format((value||0)/100);}
