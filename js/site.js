
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

// nav shadow on scroll
const nav=document.getElementById('nav');
addEventListener('scroll',()=>{nav.classList.toggle('scrolled',scrollY>20)});

// reveal on scroll
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// cascade animation
const lines=[...document.querySelectorAll('#cascade .line')];
const cio=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){lines.forEach((l,i)=>setTimeout(()=>l.classList.add('on'),i*220));cio.disconnect();}})},{threshold:.4});
if(lines.length)cio.observe(document.getElementById('cascade'));

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
