const el=q=>document.querySelector(q)
const timeEl=el('#time'), modeEl=el('#modeLabel'), startBtn=el('#startBtn'), pauseBtn=el('#pauseBtn'), resetBtn=el('#resetBtn')
const workUp=el('#workUp'), workDown=el('#workDown'), breakUp=el('#breakUp'), breakDown=el('#breakDown'), soundToggle=el('#soundToggle'), vibToggle=el('#vibToggle'), countEl=el('#count'), themeToggle=el('#themeToggle')
let workMin=25, breakMin=5, soundEnabled=false, vibEnabled=true, mode='work', running=false, targetMs=0, remainingMs=workMin*60*1000, sessions=0, intervalId=null
function fmt(ms){const t=Math.max(0,Math.floor(ms/1000));const m=Math.floor(t/60);const s=t%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function render(){timeEl.textContent=fmt(remainingMs);modeEl.textContent=mode==='work'?'Work':'Break';soundToggle.textContent=soundEnabled?'Sound: On':'Sound: Off';vibToggle.textContent=vibEnabled?'Vibration: On':'Vibration: Off';countEl.textContent=`Sessions ${sessions}`}
function load(){try{const s=JSON.parse(localStorage.getItem('pom_settings')||'{}');workMin=s.workMin||workMin;breakMin=s.breakMin||breakMin;soundEnabled=!!s.soundEnabled;vibEnabled=s.vibEnabled!==false;const c=Number(localStorage.getItem('pom_count')||'0');sessions=isNaN(c)?0:c}catch{}remainingMs=(mode==='work'?workMin:breakMin)*60*1000}
function save(){localStorage.setItem('pom_settings',JSON.stringify({workMin,breakMin,soundEnabled,vibEnabled}))}
function setTheme(d){document.body.classList.toggle('dark',d);localStorage.setItem('pom_dark',d?"1":"0");themeToggle.textContent=d?'Light':'Dark'}
setTheme(localStorage.getItem('pom_dark')==='1')
themeToggle.addEventListener('click',()=>setTheme(!document.body.classList.contains('dark')))
function scheduleNotify(when){if(Notification.permission!=='granted'){Notification.requestPermission()}const title=mode==='work'?'Work complete':'Break complete';const body=mode==='work'?'Time for a break':'Back to work';const delay=Math.max(0,when-Date.now());window._notifyTimeout&&clearTimeout(window._notifyTimeout);window._notifyTimeout=setTimeout(()=>{try{new Notification(title,{body})}catch{}},delay)}
function start(){targetMs=Date.now()+remainingMs;running=true;scheduleNotify(targetMs);if(vibEnabled&&navigator.vibrate)navigator.vibrate(20);if(intervalId)clearInterval(intervalId);intervalId=setInterval(tick,500)}
function pause(){running=false;intervalId&&clearInterval(intervalId);if(vibEnabled&&navigator.vibrate)navigator.vibrate(10);window._notifyTimeout&&clearTimeout(window._notifyTimeout)}
function reset(){running=false;intervalId&&clearInterval(intervalId);remainingMs=(mode==='work'?workMin:breakMin)*60*1000;window._notifyTimeout&&clearTimeout(window._notifyTimeout);render()}
function complete(){if(mode==='work'){sessions+=1;localStorage.setItem('pom_count',String(sessions))}mode=mode==='work'?'break':'work';remainingMs=(mode==='work'?workMin:breakMin)*60*1000;render()}
function tick(){remainingMs=Math.max(0,targetMs-Date.now());render();if(remainingMs<=0){pause();complete()}}
document.addEventListener('visibilitychange',()=>{if(running){remainingMs=Math.max(0,targetMs-Date.now());render()}})
startBtn.addEventListener('click',start)
pauseBtn.addEventListener('click',pause)
resetBtn.addEventListener('click',reset)
workUp.addEventListener('click',()=>{workMin=Math.max(1,workMin+1);save();if(!running&&mode==='work'){remainingMs=workMin*60*1000;render()}})
workDown.addEventListener('click',()=>{workMin=Math.max(1,workMin-1);save();if(!running&&mode==='work'){remainingMs=workMin*60*1000;render()}})
breakUp.addEventListener('click',()=>{breakMin=Math.max(1,breakMin+1);save();if(!running&&mode==='break'){remainingMs=breakMin*60*1000;render()}})
breakDown.addEventListener('click',()=>{breakMin=Math.max(1,breakMin-1);save();if(!running&&mode==='break'){remainingMs=breakMin*60*1000;render()}})
soundToggle.addEventListener('click',()=>{soundEnabled=!soundEnabled;save();render()})
vibToggle.addEventListener('click',()=>{vibEnabled=!vibEnabled;save();render()})
load();render()
