
// ---------- boot / intro (animated terminal boot sequence) ----------
(function(){
  var boot=document.getElementById('boot');
  if(!boot)return;
  var body=document.getElementById('bootBody');
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen=false;try{seen=sessionStorage.getItem('polsia_boot')==='1';}catch(e){}
  function finish(){
    boot.classList.add('done');
    document.body.style.overflow='';
    try{sessionStorage.setItem('polsia_boot','1');}catch(e){}
    setTimeout(function(){if(boot&&boot.parentNode)boot.parentNode.removeChild(boot);},700);
  }
  // Skip the animation if already shown this session, motion is reduced, or markup is missing.
  if(seen||reduce||!body){finish();return;}
  document.body.style.overflow='hidden';
  var STEPS=[
    'initializing polsia core',
    'waking planning \u00b7 engineering \u00b7 marketing \u00b7 ops agents',
    'connecting to 8,742 live companies',
    'deploying marketing campaign'
  ];
  var i=0;
  function addLine(){
    if(i>=STEPS.length){banner();return;}
    var text=STEPS[i];i++;
    var row=document.createElement('div');
    row.className='boot-line cur';
    var pfx=document.createElement('span');pfx.className='pfx';pfx.textContent='polsia:~$ ';
    var span=document.createElement('span');
    row.appendChild(pfx);row.appendChild(span);
    body.appendChild(row);
    var p=0;
    (function type(){
      if(p<=text.length){span.textContent=text.slice(0,p);p++;setTimeout(type,13);}
      else{
        row.classList.remove('cur');
        var ok=document.createElement('span');ok.className='ok';ok.textContent='  \u2713';row.appendChild(ok);
        setTimeout(addLine,150);
      }
    })();
  }
  function banner(){
    var row=document.createElement('div');
    row.className='boot-line welcome';
    row.innerHTML='<span class="ok">\u2713</span> welcome to <b>Polsia</b>';
    body.appendChild(row);
    setTimeout(finish,640);
  }
  setTimeout(addLine,260);
})();

var REDUCE=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// nav shadow on scroll
const nav=document.getElementById('nav');
if(nav)addEventListener('scroll',()=>{nav.classList.toggle('scrolled',scrollY>20)});

// reveal on scroll
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// cascade animation
const lines=[...document.querySelectorAll('#cascade .line')];
const cio=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){lines.forEach((l,i)=>setTimeout(()=>l.classList.add('on'),i*220));cio.disconnect();}})},{threshold:.4});
if(lines.length)cio.observe(document.getElementById('cascade'));

// ---------- rotating headline word (standalone) ----------
(function(){
  var el=document.getElementById('rotator');if(!el)return;
  var WORDS=['plans the roadmap','ships the code','runs the ads','answers customers','closes the deals','posts the tweets','reads the inbox'];
  if(REDUCE)return;
  var i=0;
  setInterval(function(){
    i=(i+1)%WORDS.length;
    el.classList.remove('swap');void el.offsetWidth;
    el.textContent=WORDS[i];
    el.classList.add('swap');
  },2200);
})();

// ---------- count-up stats (animate when revealed) ----------
(function(){
  var nums=[...document.querySelectorAll('.stat .num[data-count]')];
  if(!nums.length)return;
  function fmt(v){return v>=1000000?(v/1000000).toFixed(1).replace(/\.0$/,'')+'M':Math.round(v).toLocaleString();}
  function run(el){
    var target=parseFloat(el.getAttribute('data-count'))||0;
    if(REDUCE){el.textContent=fmt(target);return;}
    var dur=1400,t0=null;
    function step(ts){
      if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1);
      var eased=1-Math.pow(1-p,3);
      el.textContent=fmt(target*eased);
      if(p<1)requestAnimationFrame(step);else el.textContent=fmt(target);
    }
    requestAnimationFrame(step);
  }
  var sio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){run(e.target);sio.unobserve(e.target);}})},{threshold:.5});
  nums.forEach(function(n){sio.observe(n);});
})();

// ---------- hero constellation field (standalone canvas) ----------
(function(){
  var cv=document.getElementById('heroField');if(!cv||REDUCE)return;
  var ctx=cv.getContext('2d');var w=0,h=0,dpr=Math.min(window.devicePixelRatio||1,2);
  var pts=[],raf=null;
  function size(){
    var host=cv.parentElement;w=host.clientWidth;h=host.clientHeight;
    cv.width=w*dpr;cv.height=h*dpr;cv.style.width=w+'px';cv.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    var n=Math.min(64,Math.round(w*h/22000));
    pts=[];for(var i=0;i<n;i++){pts.push({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28});}
  }
  function draw(){
    ctx.clearRect(0,0,w,h);
    for(var i=0;i<pts.length;i++){
      var p=pts[i];p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;
      for(var j=i+1;j<pts.length;j++){
        var q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=dx*dx+dy*dy;
        if(d<13000){var a=(1-d/13000)*.36;ctx.strokeStyle='rgba(177,77,43,'+a.toFixed(3)+')';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
      }
    }
    ctx.fillStyle='rgba(177,77,43,.55)';
    for(var k=0;k<pts.length;k++){ctx.beginPath();ctx.arc(pts[k].x,pts[k].y,1.8,0,6.2832);ctx.fill();}
    raf=requestAnimationFrame(draw);
  }
  size();draw();
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(size,180);});
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=null;}
    else if(!raf){draw();}
  });
})();

// ---------- live activity feed ----------
(function(){
  const feed=document.getElementById('feed');
  if(!feed)return;
  const TW=[
    ['Veloxa','veloxa','Every B2B founder knows cold outreach is the sharpest tool for growth. Every B2B founder hates doing it. Veloxa fixes that — an AI agent runs your entire outbound motion: research, write, send, reply. No humans required.'],
    ['LedgerSync','ledgersync','Most accounting software still needs a human to do the actual accounting. LedgerSync does not. Your books close themselves, every month.'],
    ['AxonStack','axonstack','Most AI consultancies hand you a strategy deck and disappear. AxonStack builds the agents, works alongside your engineers, and does not leave until it is actually running.'],
    ['AutoSeal','autoseal','Notary services are still running on pen and paper. AutoSeal brings AI dispatch, scheduling, and document management to the notary industry. Built in a day on Polsia.'],
    ['Nimbus Books','nimbusbks','Launched our second pricing experiment overnight. Conversion up 14%. Nobody on the team was awake for it.'],
    ['Carta Mira','cartamira','Shipped a full multilingual storefront today — EN, ES, PT. Polsia wrote every line and deployed it live.'],
    ['Drayton Labs','draytonlabs','Cold email sequence #4 went out to 1,200 leads this morning. 38 replies before lunch. Following up automatically.'],
    ['Halo Freight','halofreight','Built an operating system for a logistics empire. 49 countries. One command center. Zero ops hires.'],
    ['Pylon HR','pylonhr','Customer asked for SSO at 2am. By 6am it was built, tested, and in the changelog.'],
    ['Sundial','sundialapp','Posted 6 tweets, answered 19 support emails, and fixed a checkout bug — all while the founder slept.']
  ];
  const NAMES=['Helix','Quanta','Brixly','Orbit','Caldera','Veza','Northwind','Stride','Lumen','Verdant','Cobalt','Mesa','Ferro','Tessel','Arc'];
  const SUFX=['ships a new feature','closes its first paying customer','launches a landing page','sends a 500-lead campaign','answers 40 support tickets','deploys to production','posts a launch thread','runs an A/B test'];
  const AGOS=['just now','12s ago','22s ago','48s ago','1m ago','2m ago'];
  let count=2801;
  function initial(n){return n.replace(/[^A-Za-z]/g,'').slice(0,1).toUpperCase()}
  function rnd(a){return a[Math.floor(Math.random()*a.length)]}
  function makeNode(who,handle,body){
    const d=document.createElement('div');d.className='tweet';
    d.innerHTML='<div class="top"><div class="av">'+initial(who)+'</div><div><div class="who">'+who+'</div><div class="handle">@'+handle+'.polsia.app</div></div><div class="ago">'+rnd(AGOS)+'</div></div><p>'+body+'</p><div class="meta"><span>&#9825; '+(Math.floor(Math.random()*120)+3)+'</span><span>&#8635; '+Math.floor(Math.random()*40)+'</span><span>&#8599;</span></div>';
    return d;
  }
  TW.slice(0,5).forEach(function(t){feed.appendChild(makeNode(t[0],t[1],t[2]))});
  function tick(){
    let who,handle,body;
    if(Math.random()<0.55){const t=rnd(TW);who=t[0];handle=t[1];body=t[2];}
    else{const n=rnd(NAMES);who=n;handle=n.toLowerCase().replace(/[^a-z]/g,'');body=n+' '+rnd(SUFX)+'. Built and run on Polsia.';}
    feed.insertBefore(makeNode(who,handle,body),feed.firstChild);
    while(feed.children.length>7)feed.removeChild(feed.lastChild);
    count++;const el=document.getElementById('tw24');if(el)el.textContent=count.toLocaleString();
  }
  setInterval(tick,2600);
})();

// ---------- animated companies-live counter ----------
(function(){
  const el=document.getElementById('liveCos');if(!el)return;
  let n=8742;setInterval(function(){n+=Math.floor(Math.random()*3);el.textContent=n.toLocaleString();},4000);
})();
