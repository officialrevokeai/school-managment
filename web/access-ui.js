let masterLoginMode=false,loginLogoTaps=0,lastLoginLogoTap=0;
function clearWorkspace(){if(liveSource)liveSource.close();liveSource=null;currentUser=null;context=null;currentData={};api.csrf='';dirty=false;document.getElementById('overlays').replaceChildren();}
function endSession(message=''){clearWorkspace();masterLoginMode=false;history.replaceState(null,'','#/signin');login();if(message)toast(message);}
function revealMasterAccess(){
 if(currentUser||document.querySelector('#reset-form'))return;
 if(dirty&&!confirm('Switch sign-in forms and clear the entered fields?'))return;
 dirty=false;masterLoginMode=true;history.replaceState(null,'','#/signin?access=platform');renderSignIn();
}
function renderSignIn(reset=false){
 if(!reset&&!location.hash.startsWith('#/signin'))history.replaceState(null,'','#/signin');
 const master=!reset&&masterLoginMode;
 document.getElementById('app').innerHTML=`<main id="main" class="auth-wrap"><section class="panel auth-card"><button type="button" class="logo auth-logo" data-action="loginLogo" aria-label="School Management">${icon('book')}</button><div class="eyebrow">SMART · SECURE · CONNECTED</div><h1>${master?'Master sign-in':'School Management'}</h1><p class="live-help">${reset?'Set your password using your one-time recovery link.':master?'Sign in with your authorized platform administrator account.':'Sign in with the account assigned by your school.'}</p>${reset?form('reset-form',field('password','New password','password','','required minlength="12" maxlength="128" autocomplete="new-password"'),'Set password'):form('login-form',`<input type="hidden" name="workspace" value="${master?'platform':'school'}">`+field('organization','Organization code','text','','required maxlength="80" autocomplete="organization" autocapitalize="none" spellcheck="false"')+field('email','Email','email','','required maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false"')+field('password','Password','password','','required maxlength="128" autocomplete="current-password"')+'<button class="btn ghost password-toggle" type="button" data-action="loginPassword" aria-pressed="false">Show password</button>',master?'Sign in to Master Panel':'Sign in')}${reset?'':master?act('School sign-in','loginSchool','','ghost'):act('Forgot password?','forgot','','ghost')}<p class="live-help">${master?'Master access is verified by the server.':'An account is required. Contact your school administrator if you do not have login credentials.'}</p></section></main>`;
}
function handleLoginAction(action){
 if(action==='loginLogo'){const now=Date.now();loginLogoTaps=now-lastLoginLogoTap<5000?loginLogoTaps+1:1;lastLoginLogoTap=now;if(loginLogoTaps>=5){loginLogoTaps=0;revealMasterAccess();}return;}
 if(action==='loginSchool'){masterLoginMode=false;dirty=false;history.replaceState(null,'','#/signin');return renderSignIn();}
 if(action==='loginPassword'){const f=document.getElementById('login-form'),input=f?.elements.password,b=f?.querySelector('.password-toggle');if(!input||!b)return;const show=input.type==='password';input.type=show?'text':'password';b.textContent=show?'Hide password':'Show password';b.setAttribute('aria-pressed',String(show));}
}
document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyM'&&!currentUser){e.preventDefault();revealMasterAccess();}});
document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#/"]');if(!a||!currentUser||!dirty)return;if(!confirm('Discard unsaved changes and leave this page?')){e.preventDefault();e.stopImmediatePropagation();}else dirty=false;},true);
function masterShell(content){document.getElementById('app').innerHTML=`<div class="master-shell"><header class="master-header"><div><strong>Master Panel</strong><small>${context.environment.startsWith('DISPOSABLE')?'Disposable synthetic test database':'School administration'}</small></div>${act('Sign out','logout','','ghost')}</header><main id="main" class="master-workspace" tabindex="-1"><p id="page-error" class="error-text" role="alert" tabindex="-1"></p>${content}<p class="live-help" id="live-database-status" role="status">${esc(liveConnection)}</p></main></div>`;}
