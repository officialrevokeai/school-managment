const PATHS={
 grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 school:'M3 21V9l9-6 9 6v12M3 21h18M9 21v-6h6v6M8 10h1m6 0h1M8 13h1m6 0h1M12 3v6',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 user:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
 shield:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7z M8 12l3 3 5-6',
 check:'M5 12l4 4L19 6',checkSquare:'M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9 M8 11l4 4L21 3',
 wallet:'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6 M20 13h-5v4h5',
 chart:'M4 3v18h18 M8 15l4-4 4 2 5-7',message:'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4 M8 10h8m-8 4h5',
 calendar:'M4 5h16v16H4z M8 3v4m8-4v4M4 10h16M8 14h2m4 0h2m-8 4h2',
 settings:'m10 3-1 3-3 1-3 3 2 2-1 4 3 1 2 4 3-1 3 1 2-4 3-1-1-4 2-2-3-3-3-1-1-3z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 history:'M3 4v5h5 M3.5 9a9 9 0 1 1 .5 8 M12 7v5l3 2',
 book:'M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1z M12 5v16',
 file:'M14 2H5v20h14V7z M14 2v6h5 M8 12h8m-8 4h6',
 folder:'M3 5h6l2 3h10v13H3z',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2',
 sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',
 megaphone:'M3 9h5l12-5v16L8 15H3z M8 15l2 7h4l-2-6M8 9v6',
 layers:'m12 2 10 5-10 5L2 7z M2 12l10 5 10-5M2 17l10 5 10-5',
 percent:'M5 19 19 5 M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 briefcase:'M3 7h18v14H3z M8 7V3h8v4M3 12l9 3 9-3M10 14v3h4v-3',
 graduation:'m2 8 10-5 10 5-10 5z M6 10v6c4 4 8 4 12 0v-6 M22 8v8',
 search:'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4',
 chevron:'m9 5 7 7-7 7',down:'m6 9 6 6 6-6',plus:'M12 5v14M5 12h14',
 arrow:'M5 12h14m-5-5 5 5-5 5',arrowUp:'m7 17 10-10M7 7h10v10',
 download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
 upload:'M12 17V3m-5 5 5-5 5 5M4 17v4h16v-4',
 logout:'M9 3H3v18h6M10 12h11m-4-4 4 4-4 4',
 more:'M5 12h.01M12 12h.01M19 12h.01',
 menu:'M3 6h18M3 12h18M3 18h18',close:'m6 6 12 12M6 18 18 6',
 info:'M12 8v.1M12 11v6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 lock:'M5 10h14v12H5z M8 10V6a4 4 0 0 1 8 0v4',
 send:'m22 2-7 20-4-9-9-4z M11 13 22 2',edit:'m16 3 5 5L8 21H3v-5z M14 5l5 5',
 print:'M6 9V2h12v7M6 17H3V9h18v8h-3M6 14h12v8H6z',
 credit:'M2 5h20v15H2z M2 10h20M6 15h3',refresh:'M20 3v6h-6M4 21v-6h6M4 8a8 8 0 0 1 13-4l3 5M4 15l3 5a8 8 0 0 0 13-4',
 mail:'M2 4h20v16H2z M2 4l10 9L22 4',eye:'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 alert:'m12 3 10 18H2z M12 9v5m0 3v.01',trash:'M3 6h18M6 6v15h12V6M9 6V3h6v3M10 10v7m4-7v7',link:'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2'
};
function icon(n){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[n]||PATHS.file}"/></svg>`}
function button(label,action,id='',style='',ico='',attrs=''){return `<button type="${attrs.includes('type=')?'submit':'button'}" class="btn ${style}" data-action="${action}" data-id="${esc(id)}" ${attrs}>${ico?icon(ico):''}${label}</button>`}
function link(label,r,style='',ico=''){return `<a class="btn ${style}" href="#/${r}">${ico?icon(ico):''}${label}</a>`}
function status(s=''){return `<span class="badge ${/Approved|Active|Published|Confirmed|Available|Recorded|Present|Resolved|Reconciled/.test(s)?'success':/Failed|Rejected|Overdue|Absent|Disconnected/.test(s)?'error':/Pending|Draft|Unpaid|Setup|Changes|Late/.test(s)?'warning':/Scheduled|Invited/.test(s)?'accent':''}">${esc(s)}</span>`}
function alertBox(title,body='',type='neutral'){return `<div class="alert ${type}">${icon(type==='error'?'alert':'info')}<div><b>${title}</b>${body?`<p>${body}</p>`:''}</div></div>`}
function heading(title,desc='',actions='',eyebrow=''){return `<div class="page-heading"><div>${eyebrow?`<div class="eyebrow">${eyebrow}</div>`:''}<h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`}
function panel(title,body,action='',subtitle='',classes=''){return `<section class="panel ${classes}"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${action}</div>${body}</section>`}
function stat(label,value,change,note,ico='users'){return `<div class="panel stat"><div class="stat-label">${label}${icon(ico)}</div><div class="stat-value">${value}</div><div class="stat-bottom">${change?`<span class="stat-change">↗ ${change}</span>`:''}<span>${note}</span></div><svg class="stat-line" viewBox="0 0 100 30" aria-hidden="true"><path d="M1 25 12 22 23 24 33 15 44 18 56 12 65 15 75 7 86 9 99 2" fill="none" stroke="#9ca2b5" stroke-width="1.5"/></svg></div>`}
function tabs(items,selected){return `<div class="tabs" role="tablist">${items.map(([id,label])=>`<button class="tab ${id===selected?'active':''}" role="tab" aria-selected="${id===selected}" data-action="tab" data-id="${id}">${label}</button>`).join('')}</div>`}
function empty(title='No records found',desc='Try changing your search or filters.',action=''){return `<div class="empty">${icon('folder')}<h3>${title}</h3><p>${desc}</p>${action}</div>`}
function table(headers,rows,cls=''){if(!cls&&['Name / record','Student','Fee item','Request','Payment / student','Person'].includes(headers[0])&&headers.length>=5)cls='record-table';rows=rows.map(row=>{let i=0;return row.replace(/<td(\s[^>]*)?>/g,(match,attrs)=>'<td data-label="'+esc(String(headers[i++]||'').replace(/<[^>]*>/g,''))+'"'+(attrs||'')+'>')});return `<div class="table-wrap"><table class="${cls}"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function person(name,sub=''){return `<div class="cell-person"><span class="avatar">${esc(initials(name))}</span><span><strong>${esc(name)}</strong><small>${esc(sub)}</small></span></div>`}
function filtered(rows){let q=search.toLowerCase();let a=rows.filter(x=>(filter==='All'||x.status===filter||x.type===filter||x.category===filter)&&(!q||Object.values(x).filter(v=>typeof v!=='object').join(' ').toLowerCase().includes(q)));if(sort==='az')a.sort((a,b)=>(a.name||'').localeCompare(b.name||''));else if(sort==='amount')a.sort((a,b)=>(b.amount||0)-(a.amount||0));return a}
function toolbar(rows,extras=''){const states=[...new Set(rows.map(x=>x.status).filter(Boolean))];return `<div class="toolbar"><div class="searchfield">${icon('search')}<input type="search" id="record-search" value="${esc(search)}" placeholder="Search ${(TITLES[route]||'records').toLowerCase()}…" aria-label="Search records"></div><select id="status-filter" aria-label="Filter by status"><option value="All">All statuses</option>${states.map(s=>`<option ${filter===s?'selected':''}>${esc(s)}</option>`).join('')}</select><select id="sort-filter" aria-label="Sort records"><option value="newest" ${sort==='newest'?'selected':''}>Recent first</option><option value="az" ${sort==='az'?'selected':''}>Name A–Z</option><option value="amount" ${sort==='amount'?'selected':''}>Amount: high to low</option></select>${extras}${search||filter!=='All'?button('Clear all','clearFilters','','ghost small'):''}</div>`}
function paginate(total){let max=Math.max(1,Math.ceil(total/7));page=Math.min(page,max);return `<div class="pagination"><span>${total===0?'0':(page-1)*7+1}–${Math.min(page*7,total)} of ${total} records</span><div>${button('Previous','page',String(page-1),'small','',''+(page===1?'disabled':''))} <span>${page} / ${max}</span> ${button('Next','page',String(page+1),'small','',''+(page===max?'disabled':''))}</div></div>`}
