/* ==========================================================================
   RENDERING ENGINE — reads the CV object from content.js and draws the
   page: globe geometry and projection, the timeline, the drawer, the
   compass rose, and the plain-text fallback. You should not need to edit
   this file to update your CV — see content.js for that. Loaded after
   content.js, and uses its global `CV` constant.
   ========================================================================== */

/* ==========================================================================
   2. SMALL HELPERS
   ========================================================================== */
const D2R = Math.PI/180, R2D = 180/Math.PI, TAU = Math.PI*2;
const $ = (s,r=document)=>r.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const el = (n,attrs={})=>{const e=document.createElementNS(NS,n);
  for(const k in attrs) e.setAttribute(k,attrs[k]); return e;};
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const isTodo = s => typeof s==="string" && /\bADD\b/.test(s);
/* Wrap any ADD text in a marker class so every gap is visibly yellow. */
const mark = s => isTodo(s) ? '<span class="todo">'+esc(s)+'</span>' : esc(s);
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* "YYYY-MM" -> months since year 0, so date arithmetic is just subtraction. */
function tOf(ym){ if(!ym) return null; const [y,m]=ym.split("-").map(Number); return y*12+(m-1); }
const NOW_T = (()=>{const d=new Date(); return d.getFullYear()*12+d.getMonth();})();
function fmt(ym){ if(!ym) return ""; const [y,m]=ym.split("-").map(Number); return MONTHS[m-1]+" "+y; }
function span(job){
  return job.ongoing ? fmt(job.from)+" — present" : fmt(job.from)+" — "+fmt(job.to);
}
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==========================================================================
   3. GEOMETRY
   ==========================================================================
   3a. CHRONOLOGY -> LONGITUDE
   The working life is laid along the equator. The first job's start date is
   pinned at lonWest, today is pinned at lonEast, and everything between is
   linear in months. Spinning the globe eastward therefore walks forward
   through the work. The 60° of water left over behind the antimeridian is
   the part of the life that has no jobs in it: The Long Water.
     lon(t) = lonWest + (lonEast - lonWest) * (t - t0) / (NOW - t0)
   ------------------------------------------------------------------------ */
const JOBS = CV.jobs;
const T0 = tOf(JOBS[0].from);
const TSPAN = Math.max(1, NOW_T - T0);
const lonForT = t => CV.globe.lonWest + (CV.globe.lonEast - CV.globe.lonWest) * (t - T0) / TSPAN;

/* 3b. DURATION -> AREA
   A landmass is a lumpy spherical cap. The solid angle of a cap of angular
   radius rho is  Omega = 2*PI*(1 - cos rho), and the whole sphere is 4*PI,
   so the fraction of the globe a cap covers is (1 - cos rho)/2. Invert it:
     rho = acos(1 - 2 * fraction)
   Each job's fraction is its share of the total months, scaled by
   landFraction so the sea still dominates. Because the current job's months
   are counted to today, its continent grows every month on its own. */
function rhoFor(months, totalMonths){
  const fraction = (months/totalMonths) * CV.globe.landFraction;
  return Math.acos(1 - 2*fraction) * R2D;   // degrees of arc from centre to coast
}

/* 3c. COASTLINE
   A circle would read as a bubble, not a country. So the radius is modulated
   by a sum of integer harmonics — periodic, therefore the coast closes — and
   then rescaled so that mean(w^2) = 1. Since a small cap's area goes as
   rho^2, holding mean(w^2) at 1 holds the area the duration bought, however
   ragged the outline gets. (Exact for small caps, within a couple of percent
   for the big ones. Good enough for a CV; not good enough for a chart table.)
   Increase the amplitudes for a wilder coast; lower them for calmer islands. */
const HARMONICS = [[2,.17],[3,.115],[5,.075],[7,.05],[11,.03]];
function coastline(job, rho){
  const N = 108, w = new Array(N);
  const ph = HARMONICS.map((h,i)=> ((Math.sin(job.seed*(i+1)*12.9898)*43758.5453) % 1) * TAU);
  let sumSq = 0;
  for(let i=0;i<N;i++){
    const th = i/N*TAU; let v = 1;
    HARMONICS.forEach((h,k)=>{ v += h[1]*Math.sin(h[0]*th + ph[k]); });
    w[i]=v; sumSq += v*v;
  }
  const s = 1/Math.sqrt(sumSq/N);            // area-preserving rescale
  const pts = [];
  for(let i=0;i<N;i++){
    pts.push(destination(job._lat, job._lon, i/N*360, rho*s*w[i]));
  }
  return pts;
}

/* Great-circle destination: from (lat,lon), walk `dist` degrees of arc along
   `bearing`. This is what makes the coastline sit on the sphere instead of
   being drawn flat and then bent. */
function destination(lat, lon, bearing, dist){
  const f1=lat*D2R, l1=lon*D2R, th=bearing*D2R, d=dist*D2R;
  const sf2 = Math.sin(f1)*Math.cos(d) + Math.cos(f1)*Math.sin(d)*Math.cos(th);
  const f2 = Math.asin(Math.max(-1,Math.min(1,sf2)));
  const l2 = l1 + Math.atan2(Math.sin(th)*Math.sin(d)*Math.cos(f1), Math.cos(d)-Math.sin(f1)*sf2);
  return [f2*R2D, ((l2*R2D + 540) % 360) - 180];
}

/* 3d. ORTHOGRAPHIC PROJECTION
   The camera looks at (lat0, lon0) from infinitely far away. Turn the point
   into a unit vector, rotate it by -lon0 about the polar axis and then by
   -lat0 about the horizontal, and read the answer off: the component toward
   the camera (v[0]) is the visibility test, and the other two components are
   the screen offsets. No perspective, which is what an atlas plate wants.
   CX/CY/RAD are in viewBox units, not pixels. */
const CX = 500, CY = 500, RAD = 372;
const view = { lon0: 0, lat0: CV.globe.tilt };
function camVec(lat, lon){
  const f = lat*D2R, l = (lon - view.lon0)*D2R, f0 = view.lat0*D2R;
  const cf = Math.cos(f);
  const x = cf*Math.cos(l), y = cf*Math.sin(l), z = Math.sin(f);
  return [ x*Math.cos(f0) + z*Math.sin(f0),      // toward the viewer: > 0 is the near side
           y,                                     // screen x
          -x*Math.sin(f0) + z*Math.cos(f0) ];     // screen y (up)
}
const sx = v => CX + RAD*v[1];
const sy = v => CY - RAD*v[2];

/* Build an SVG path from lat/lon points, dropping the far side of the sphere.
   Two details matter here and both are easy to get wrong:

   1. Where an edge crosses the horizon, the two camera vectors are
      interpolated to the crossing and renormalised. That lands the point
      exactly on the limb, so a continent going round the back is cut by the
      edge of the world rather than by a bounding box.
   2. A closed shape that straddles the limb must be closed ALONG the limb,
      not with a straight chord — otherwise a continent rotating out of view
      develops a flat guillotined edge. So the subpath is closed with an SVG
      arc of the sphere's own radius. To make sure every visible run is
      bounded by two crossings, the point list is first rotated to start on
      the hidden side. */
const fx = p => p[0].toFixed(1)+" "+p[1].toFixed(1);
const scr = v => [sx(v), sy(v)];
function rimPoint(a, b){                       // where segment a→b crosses the horizon
  const t = a[0]/(a[0]-b[0]);
  let m = [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
  const L = Math.hypot(m[0],m[1],m[2]) || 1;
  return m.map(c=>c/L);                        // renormalise: |v| = 1 puts it on the limb
}
/* Which way round the limb is the short way from exit back to entry?
   Screen space has y pointing down, so a positive cross product is clockwise,
   which is SVG's sweep-flag = 1. */
function sweepFlag(from, to){
  const ux = from[0]-CX, uy = from[1]-CY, vx = to[0]-CX, vy = to[1]-CY;
  return (ux*vy - uy*vx) > 0 ? 1 : 0;
}
function spherePath(pts, closed){
  let V = pts.map(p => camVec(p[0], p[1]));
  const n = V.length;
  if(closed){
    const k = V.findIndex(v => v[0] <= 0);
    if(k === -1){}                             // wholly visible
    else if(!V.some(v => v[0] > 0)) return "";  // wholly behind the sphere
    else if(k > 0) V = V.slice(k).concat(V.slice(0,k));
  }
  const segs = closed ? n : n-1;
  let d = "", open = false, entry = null, exit = null;
  const closeSub = ()=>{
    if(!open) return;
    if(entry && exit) d += "A"+RAD+" "+RAD+" 0 0 "+sweepFlag(exit,entry)+" "+fx(entry)+"Z";
    else d += "Z";
    open = false; entry = null; exit = null;
  };
  for(let i=0;i<segs;i++){
    const a = V[i], b = V[(i+1) % n];
    const av = a[0] > 0, bv = b[0] > 0;
    if(av){
      if(!open){ d += "M"+fx(scr(a)); open = true; }
      else d += "L"+fx(scr(a));
    }
    if(av !== bv){
      const m = scr(rimPoint(a,b));
      if(av){ d += "L"+fx(m); exit = m; if(closed) closeSub(); else open = false; }
      else { d += "M"+fx(m); open = true; entry = m; }
    }
  }
  if(closed) closeSub();
  else if(open && V[n-1][0] > 0) d += "L"+fx(scr(V[n-1]));
  return d;
}

/* Great-circle arc between two points, for the shipping lanes. */
function arcPoints(a, b, n){
  const va = camDirection(a), vb = camDirection(b);
  const dot = Math.max(-1,Math.min(1, va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2]));
  const om = Math.acos(dot), so = Math.sin(om);
  const out = [];
  for(let i=0;i<=n;i++){
    const t = i/n;
    let v;
    if(so < 1e-6) v = va;
    else{
      const s1 = Math.sin((1-t)*om)/so, s2 = Math.sin(t*om)/so;
      v = [va[0]*s1+vb[0]*s2, va[1]*s1+vb[1]*s2, va[2]*s1+vb[2]*s2];
    }
    const L = Math.hypot(v[0],v[1],v[2]) || 1;
    out.push([ Math.asin(v[2]/L)*R2D, Math.atan2(v[1]/L, v[0]/L)*R2D ]);
  }
  return out;
}
/* world-space (not camera-space) unit vector, used only for the arc maths */
function camDirection(p){
  const f=p[0]*D2R, l=p[1]*D2R, cf=Math.cos(f);
  return [cf*Math.cos(l), cf*Math.sin(l), Math.sin(f)];
}

/* ==========================================================================
   4. PREPARE THE MODEL
   ========================================================================== */
const byId = {};
JOBS.forEach(j=>{
  j._t = tOf(j.from);
  j._months = j.ongoing ? Math.max(1, NOW_T - j._t) : j.months;
  j._lon = lonForT(j._t);
  j._lat = j.lat;
  byId[j.id] = j;
});
const TOTAL_MONTHS = JOBS.reduce((s,j)=>s+j._months,0);
JOBS.forEach(j=>{
  j._rho  = rhoFor(j._months, TOTAL_MONTHS);
  j._coast = coastline(j, j._rho);
  j._share = j._months/TOTAL_MONTHS;
  (j.projects||[]).forEach(p=>{
    p._pos = destination(j._lat, j._lon, p.at[0], j._rho*p.at[1]);
    p._job = j;
  });
});

/* oceans: longitude is the middle of the gap they sit in */
CV.oceans.forEach(o=>{
  if(o.lon === undefined){
    const a = o.after ? tOf(byId[o.after].to || byId[o.after].from) : T0;
    const b = o.before ? tOf(byId[o.before].from) : NOW_T;
    o.lon = lonForT((a+b)/2);
    o._span = fmt(byId[o.after].to) + " — " + fmt(byId[o.before].from);
    o._width = b - a;
  } else {
    o._span = "before " + fmt(JOBS[0].from);
    o._width = null;
  }
});

/* lanes */
CV.lanes.forEach(l=>{
  l.a = byId[l.from]; l.b = byId[l.to];
  l._pts = arcPoints([l.a._lat,l.a._lon], [l.b._lat,l.b._lon], 40);
  l.id = "lane-"+l.from+"-"+l.to;
});

/* the line: jobs and life events in one ordered list */
const LINE = CV.life.map(e=>{
  if(e.ref){
    const j = byId[e.ref];
    return { id:j.id, kind:"job", job:j, title:j.role, org:j.org+", "+j.place,
             dateText:span(j), months:j._months };
  }
  return Object.assign({}, e);
});

/* ==========================================================================
   5. DRAW THE GLOBE
   ========================================================================== */
const gPar = $("#parallels"), gMer = $("#meridians"), gYear = $("#years"),
      gLane = $("#lanes"), gFeat = $("#features"), svg = $("#globe");
const paths = { mer:[], lands:[], pins:[], seas:[], lanes:[], years:[] };

/* Parallels every 20°. In an orthographic projection with a fixed camera
   latitude a parallel is the same shape whatever the longitude, so these are
   drawn once and never touched again. Meridians are not, so they are redrawn
   every frame. */
function buildParallels(){
  for(let lat=-80; lat<=80; lat+=20){
    const pts=[]; for(let lon=-180; lon<=180; lon+=3) pts.push([lat,lon]);
    const p = el("path",{ class:"grat"+(lat===0?" eq":""), d:spherePath(pts,false) });
    gPar.appendChild(p); paths.parallels = paths.parallels||[]; paths.parallels.push({e:p,pts});
  }
}
function buildMeridians(){
  for(let lon=-180; lon<180; lon+=20){
    const pts=[]; for(let lat=-90; lat<=90; lat+=3) pts.push([lat,lon]);
    const p = el("path",{ class:"grat", d:"" });
    gMer.appendChild(p); paths.mer.push({e:p,pts});
  }
}

/* Year ticks around the equator: the chronological scale made visible. */
function buildYears(){
  const y0 = Math.ceil(T0/12), y1 = Math.floor(NOW_T/12);
  for(let y=y0; y<=y1; y++){
    const lon = lonForT(y*12);
    const g = el("g");
    const tick = el("line",{class:"tick"});
    const lab = el("text",{class:"yearlab","text-anchor":"middle"});
    lab.textContent = y;
    g.appendChild(tick); g.appendChild(lab); gYear.appendChild(g);
    paths.years.push({g,tick,lab,lon});
  }
}

/* Features — oceans and continents — are appended in chronological order so
   that Tab walks the working life forward. Landmasses are drawn in the same
   order, which means later jobs overlap earlier ones where they collide. */
function buildFeatures(){
  const feats = [];
  CV.oceans.forEach(o=>{
    const t = o.after ? tOf(byId[o.after].to) : T0 - 1;
    feats.push({ t, type:"sea", data:o });
  });
  JOBS.forEach(j=> feats.push({ t:j._t, type:"land", data:j }));
  feats.sort((a,b)=>a.t-b.t);

  feats.forEach(f=>{
    if(f.type==="sea"){
      const o = f.data;
      const g = el("g",{class:"sea-g","data-sea":o.id});
      const t = el("text",{class:"sea","text-anchor":"middle"});
      t.textContent = o.name;
      g.appendChild(t); gFeat.appendChild(g);
      paths.seas.push({g,t,o});
      g.addEventListener("pointerenter",()=>lightSea(o.id,true));
      g.addEventListener("pointerleave",()=>lightSea(o.id,false));
      g.addEventListener("click",()=>openSea(o.id));
      return;
    }
    const j = f.data;
    const g = el("g",{class:"land-g"+(j.ongoing?" now":""),"data-job":j.id});
    const a = el("a",{class:"landlink", href:"#work-"+j.id,
      "aria-label": j.role+", "+j.org+". "+j._months+" months, "+
        Math.round(j._share*100)+" per cent of the working life so far."});
    const sh = el("path",{class:"land-shadow"});
    const fill = el("path",{class:"land-fill"});
    const hatch = el("path",{class:"land-hatch"});
    const coast = el("path",{class:"land-coast"});
    const lab = el("text",{class:"landlab","text-anchor":"middle"});
    lab.textContent = shortOrg(j);
    a.appendChild(sh); a.appendChild(fill); a.appendChild(hatch);
    a.appendChild(coast); a.appendChild(lab);
    g.appendChild(a); gFeat.appendChild(g);

    a.addEventListener("click", ev=>{
      if(ev.metaKey||ev.ctrlKey||ev.shiftKey) return;   // let people open the text version
      ev.preventDefault(); openJob(j.id, true);
    });
    a.addEventListener("focus", ()=>{ light(j.id,true); turnTo(j._lon, j._lat); });
    a.addEventListener("blur", ()=>light(j.id,false));
    g.addEventListener("pointerenter",()=>light(j.id,true));
    g.addEventListener("pointerleave",()=>light(j.id,false));

    const pinEls = [];
    (j.projects||[]).forEach((p,i)=>{
      const pa = el("a",{class:"pin"+(p.repo?" repo":""), href: p.repo && !isTodo(p.repo) ? p.repo : "#work-"+j.id,
        "aria-label":"Project: "+p.name+(p.repo&&!isTodo(p.repo)?" (link)":"")});
      if(p.repo && !isTodo(p.repo)){ pa.setAttribute("target","_blank"); pa.setAttribute("rel","noopener"); }
      const stem = el("line"), dot = el("circle",{r:3.4});
      const t = el("text",{class:"pinlab","text-anchor":"start"});
      t.textContent = isTodo(p.name) ? "ADD project" : p.name;
      pa.appendChild(stem); pa.appendChild(dot); pa.appendChild(t);
      g.appendChild(pa);
      pa.addEventListener("click", ev=>{
        if(p.repo && !isTodo(p.repo)) return;
        if(ev.metaKey||ev.ctrlKey||ev.shiftKey) return;
        ev.preventDefault(); openJob(j.id, true, i);
      });
      pa.addEventListener("focus", ()=>{ light(j.id,true); turnTo(j._lon, j._lat); });
      pa.addEventListener("blur", ()=>light(j.id,false));
      pinEls.push({pa,stem,dot,t,p});
    });
    paths.lands.push({g,sh,fill,hatch,coast,lab,j,pins:pinEls});
  });
}
function shortOrg(j){
  return ({techrecipes:"Tech-Recipes", creative:"Creative Solutions", bitsol:"Bitsol",
    ptcl:"PTCL / Ufone", haidri:"Haidri", asimplify:"Asimplify", taro:"Taro, New York",
    jazz:"Jazz", technetium:"Technetium"})[j.id] || j.org;
}

function buildLanes(){
  CV.lanes.forEach(l=>{
    const g = el("g",{class:"lane-g","data-lane":l.id});
    const hit = el("path",{class:"lane-hit"});
    const p = el("path",{class:"lane"});
    const t = el("text",{class:"lanelab","text-anchor":"middle"});
    t.textContent = l.label;
    g.appendChild(p); g.appendChild(hit); g.appendChild(t); gLane.appendChild(g);
    hit.addEventListener("pointerenter",()=>g.classList.add("lit"));
    hit.addEventListener("pointerleave",()=>g.classList.remove("lit"));
    hit.addEventListener("click",()=>openLane(l));
    paths.lanes.push({g,p,hit,t,l});
  });
}

/* One frame. Everything that moves is an attribute write on an existing
   element; nothing is created or destroyed after setup. */
function draw(){
  paths.parallels.forEach(o=> o.e.setAttribute("d", spherePath(o.pts,false)));
  paths.mer.forEach(o=> o.e.setAttribute("d", spherePath(o.pts,false)));

  paths.years.forEach(o=>{
    const v = camVec(0, o.lon);
    if(v[0] <= 0.06){ o.g.setAttribute("opacity","0"); return; }
    o.g.setAttribute("opacity", Math.min(1, (v[0]-0.06)*3).toFixed(2));
    const x = sx(v), y = sy(v);
    const inner = 0.955, outer = 0.995;   // ticks hang just inside the limb
    o.tick.setAttribute("x1", CX + (x-CX)*inner); o.tick.setAttribute("y1", CY + (y-CY)*inner);
    o.tick.setAttribute("x2", CX + (x-CX)*outer); o.tick.setAttribute("y2", CY + (y-CY)*outer);
    o.lab.setAttribute("x", CX + (x-CX)*0.905); o.lab.setAttribute("y", CY + (y-CY)*0.905 + 4);
  });

  paths.lanes.forEach(o=>{
    const d = spherePath(o.l._pts, false);
    o.p.setAttribute("d", d); o.hit.setAttribute("d", d);
    const mid = o.l._pts[Math.floor(o.l._pts.length/2)];
    const v = camVec(mid[0], mid[1]);
    if(v[0] <= 0){ o.t.setAttribute("opacity","0"); return; }
    o.t.removeAttribute("opacity");
    o.t.setAttribute("x", sx(v)); o.t.setAttribute("y", sy(v) - 8);
  });

  paths.seas.forEach(o=>{
    const v = camVec(o.o.lat, o.o.lon);
    if(v[0] <= 0.25){ o.g.setAttribute("opacity","0"); o.g.style.pointerEvents="none"; return; }
    o.g.setAttribute("opacity", Math.min(1,(v[0]-0.25)*2.4).toFixed(2));
    o.g.style.pointerEvents = "auto";
    o.t.setAttribute("x", sx(v)); o.t.setAttribute("y", sy(v));
  });

  paths.lands.forEach(o=>{
    const d = spherePath(o.j._coast, true);
    const c = camVec(o.j._lat, o.j._lon);
    if(!d){ o.g.setAttribute("opacity","0"); o.g.style.pointerEvents="none"; }
    else{
      o.g.removeAttribute("opacity"); o.g.style.pointerEvents="auto";
      o.fill.setAttribute("d", d); o.hatch.setAttribute("d", d); o.coast.setAttribute("d", d);
      o.sh.setAttribute("d", d);
      /* the shadow is the same coast, offset away from the light: this is
         what makes hover feel like the land is lifting off the plate */
      o.sh.setAttribute("transform","translate(1.5,2)");
    }
    if(c[0] > 0.34){
      o.lab.setAttribute("opacity", Math.min(1,(c[0]-0.34)*3).toFixed(2));
      o.lab.setAttribute("x", sx(c)); o.lab.setAttribute("y", sy(c)+4);
    } else o.lab.setAttribute("opacity","0");

    o.pins.forEach(pn=>{
      const v = camVec(pn.p._pos[0], pn.p._pos[1]);
      if(v[0] <= 0.12){ pn.pa.setAttribute("opacity","0"); pn.pa.style.pointerEvents="none"; return; }
      pn.pa.removeAttribute("opacity"); pn.pa.style.pointerEvents="auto";
      const x = sx(v), y = sy(v);
      pn.dot.setAttribute("cx",x); pn.dot.setAttribute("cy",y-9);
      pn.stem.setAttribute("x1",x); pn.stem.setAttribute("y1",y);
      pn.stem.setAttribute("x2",x); pn.stem.setAttribute("y2",y-6);
      pn.t.setAttribute("x",x+7); pn.t.setAttribute("y",y-12);
    });
  });
}

/* ==========================================================================
   6. MOTION: idle spin, drag with momentum, and turning to face something
   ========================================================================== */
let vel = 0, dragging = false, reading = false, hoverGlobe = false, hoverNode = false;
const hovering = ()=> hoverGlobe || hoverNode;
let target = null;                       // {lon, lat} while turning
function norm(a){ return ((a+180)%360+360)%360-180; }

function turnTo(lon, lat){
  if(REDUCED){ view.lon0 = lon; if(lat!==undefined) view.lat0 = clampLat(lat*0.55+CV.globe.tilt*0.45); draw(); return; }
  target = { lon, lat: lat===undefined ? view.lat0 : clampLat(lat*0.55 + CV.globe.tilt*0.45) };
  vel = 0;
}
const clampLat = v => Math.max(-58, Math.min(58, v));

function tick(){
  if(target){
    const dl = norm(target.lon - view.lon0), dt = target.lat - view.lat0;
    if(Math.abs(dl) < .25 && Math.abs(dt) < .25){ view.lon0 = target.lon; view.lat0 = target.lat; target = null; }
    else { view.lon0 = norm(view.lon0 + dl*0.12); view.lat0 += dt*0.12; }
    draw();
  } else if(dragging){
    /* drawn from the pointer handler */
  } else if(Math.abs(vel) > 0.004){
    vel *= 0.945; view.lon0 = norm(view.lon0 + vel); draw();
  } else if(!REDUCED && !reading && !hovering()){
    view.lon0 = norm(view.lon0 + CV.globe.idleSpin); draw();
  }
  requestAnimationFrame(tick);
}

let last = null;
svg.addEventListener("pointerdown", e=>{
  if(e.target.closest("a")) return;              // a click on land is a click, not a drag
  dragging = true; target = null; last = {x:e.clientX, y:e.clientY, touch:e.pointerType==="touch"};
  svg.classList.add("dragging"); svg.setPointerCapture(e.pointerId);
});
svg.addEventListener("pointermove", e=>{
  if(!dragging || !last) return;
  const rect = svg.getBoundingClientRect();
  const k = 320/Math.max(rect.width,1);          // viewBox degrees per pixel, roughly
  const dx = (e.clientX-last.x)*k, dy = (e.clientY-last.y)*k;
  view.lon0 = norm(view.lon0 - dx);
  /* Vertical drag tilts, but not on touch: on a phone a vertical swipe over
     the globe has to keep scrolling the page. */
  if(!last.touch) view.lat0 = clampLat(view.lat0 + dy*0.6);
  vel = -dx*0.55;
  last = {x:e.clientX, y:e.clientY, touch:last.touch};
  draw();
});
function endDrag(){ dragging = false; svg.classList.remove("dragging"); }
svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", endDrag);
svg.addEventListener("pointerleave", ()=>{ if(dragging) endDrag(); });
svg.addEventListener("pointerenter", ()=>{ hoverGlobe = true; });
svg.addEventListener("pointerleave", ()=>{ hoverGlobe = false; });

/* ==========================================================================
   7. THE WIRING between the two panels
   ========================================================================== */
function light(jobId, on){
  const lg = gFeat.querySelector('[data-job="'+jobId+'"]');
  if(lg) lg.classList.toggle("lit", on);
  const li = $('#timeline [data-id="'+jobId+'"]');
  if(li) li.classList.toggle("lit", on);
  hoverNode = on;
}
function lightSea(id, on){
  const g = gFeat.querySelector('[data-sea="'+id+'"]');
  if(g) g.classList.toggle("lit", on);
}

/* Mark a job as the selected one everywhere it appears — globe, timeline,
   and (if built) the experience carousel — and turn the globe to face it.
   This is the one function that keeps all three panels in agreement about
   which job is "current"; openJob() and the carousel controls both call it
   instead of duplicating the selection logic three times. */
function focusJob(id){
  const j = byId[id];
  gFeat.querySelectorAll(".open").forEach(e=>e.classList.remove("open"));
  $("#timeline").querySelectorAll(".open").forEach(e=>e.classList.remove("open"));
  const lg = gFeat.querySelector('[data-job="'+id+'"]');
  if(lg) lg.classList.add("open");
  const li = $('#timeline [data-id="'+id+'"]');
  if(li) li.classList.add("open");
  turnTo(j._lon, j._lat);
  if(typeof goToSlide === "function") goToSlide(id, {silent:true});
  return li;
}

/* ==========================================================================
   8. THE DRAWER
   ========================================================================== */
const drawer = $("#drawer"), drawerIn = $("#drawerIn"), drawerClose = $("#drawerClose");
let returnFocus = null;

function openDrawer(html, focusEl){
  drawerIn.innerHTML = html;
  drawer.dataset.open = "true";
  reading = true;                                 // rotation stops while reading
  returnFocus = focusEl || document.activeElement;
  drawerClose.focus();
}
function closeDrawer(){
  drawer.dataset.open = "false"; reading = false;
  gFeat.querySelectorAll(".open").forEach(e=>e.classList.remove("open"));
  $("#timeline").querySelectorAll(".open").forEach(e=>e.classList.remove("open"));
  if(returnFocus && returnFocus.focus) returnFocus.focus();
  returnFocus = null;
}
drawerClose.addEventListener("click", closeDrawer);
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && drawer.dataset.open==="true") closeDrawer(); });
drawerIn.addEventListener("click", ev=>{
  const jump = ev.target.closest("[data-jump]");
<<<<<<< HEAD
  if(jump){
    ev.preventDefault();
    closeDrawer();
    focusJob(jump.dataset.jump);
    $("#experience").scrollIntoView({behavior:REDUCED?"auto":"smooth", block:"start"});
    return;
  }
  const photoBtn = ev.target.closest("[data-photo]");
  if(photoBtn){
    const img = drawerIn.querySelector('[data-img="'+photoBtn.dataset.photo+'"]');
    if(!img) return;
    const show = !img.classList.contains("show");
    img.classList.toggle("show", show);
    photoBtn.textContent = show ? "Hide photo" : "Show photo";
  }
=======
  if(!jump) return;
  ev.preventDefault();
  closeDrawer();
  focusJob(jump.dataset.jump);
  $("#experience").scrollIntoView({behavior:REDUCED?"auto":"smooth", block:"start"});
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
});

function openJob(id, fromGlobe, pinIndex){
  const j = byId[id];
  const li = focusJob(id);
  if(li && fromGlobe) li.scrollIntoView({block:"center", behavior:REDUCED?"auto":"smooth"});

  const lanesIn = CV.lanes.filter(l=>l.to===id), lanesOut = CV.lanes.filter(l=>l.from===id);
  let h = '<h2 id="drawerTitle">'+mark(j.role)+'</h2>'+
    '<p class="where">'+mark(j.org)+', '+mark(j.place)+'</p>'+
    '<div class="meta"><span>'+span(j)+' · '+j._months+' months'+(j.ongoing?', still running':'')+'</span>'+
    '<span>'+Math.round(j._share*100)+'% of the working life so far · '+
    'landmass radius '+j._rho.toFixed(1)+'°</span></div>';
<<<<<<< HEAD

  if(j.website){
    h += isTodo(j.website)
      ? '<p class="xp-website todo">'+esc(j.website)+'</p>'
      : '<a class="xp-website" href="'+esc(j.website)+'" target="_blank" rel="noopener">'+esc(j.website)+' ↗</a>';
  }
  if((j.skills||[]).length){
    h += '<div class="xp-tags">'+j.skills.map(s=>
      '<span class="xp-tag'+(isTodo(s)?' todo':'')+'">'+esc(s)+'</span>').join("")+'</div>';
  }

  j.notes.forEach(n=> h += '<p'+(isTodo(n)?' class="todo"':'')+'>'+esc(n)+'</p>');

  if(j.photo && !isTodo(j.photo)){
    h += '<button type="button" class="xp-photo-btn" data-photo="'+j.id+'">Show photo</button>'+
      '<img class="xp-photo" data-img="'+j.id+'" src="'+esc(j.photo)+'" '+
      'alt="'+esc(j.role)+' at '+esc(j.org)+'">';
  }

=======
  j.notes.forEach(n=> h += '<p'+(isTodo(n)?' class="todo"':'')+'>'+esc(n)+'</p>');
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
  if((j.projects||[]).length){
    h += '<p class="sub">Projects on this landmass</p><ul class="projects">';
    j.projects.forEach((p,i)=>{
      h += '<li'+(i===pinIndex?' style="border-left:2px solid var(--signal);padding-left:.7rem"':'')+'>'+
        '<b'+(isTodo(p.name)?' class="todo"':'')+'>'+esc(p.name)+'</b>'+
        '<span'+(isTodo(p.blurb)?' class="todo"':'')+'>'+esc(p.blurb)+'</span>'+
        (p.repo && !isTodo(p.repo) ? '<a href="'+esc(p.repo)+'" target="_blank" rel="noopener">Link</a>' : '')+
        '</li>';
    });
    h += '</ul>';
  }
<<<<<<< HEAD

  if((j.references||[]).length){
    h += '<p class="sub">References</p><ul class="projects">';
    j.references.forEach(r=>{
      h += '<li><b'+(isTodo(r.name)?' class="todo"':'')+'>'+esc(r.name)+'</b>'+
        '<span'+(isTodo(r.role)?' class="todo"':'')+'>'+esc(r.role)+'</span></li>';
    });
    h += '</ul>';
  }

=======
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
  if(lanesIn.length || lanesOut.length){
    h += '<p class="sub">Lanes</p>';
    lanesIn.forEach(l=> h += '<p>Carried in from '+esc(shortOrg(l.a))+': '+esc(l.label)+'. '+mark(l.note)+'</p>');
    lanesOut.forEach(l=> h += '<p>Carried out to '+esc(shortOrg(l.b))+': '+esc(l.label)+'. '+mark(l.note)+'</p>');
  }
<<<<<<< HEAD
  h += '<p class="sub">Elsewhere</p><p><a href="#xp-'+id+'" data-jump="'+id+'">Back to the card on the carousel</a></p>';
  openDrawer(h);

  const img = drawerIn.querySelector(".xp-photo");
  if(img) img.addEventListener("error", ()=>{
    const btn = drawerIn.querySelector('[data-photo="'+img.dataset.img+'"]');
    const note = document.createElement("p");
    note.className = "xp-website todo";
    note.textContent = "Photo not found at "+img.getAttribute("src")+" — check the path in content.js.";
    img.replaceWith(note);
    if(btn) btn.remove();
  });
=======
  h += '<p class="sub">Elsewhere</p><p><a href="#xp-'+id+'" data-jump="'+id+'">The full write-up below</a></p>';
  openDrawer(h);
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
}

function openLife(entry){
  const li = $('#timeline [data-id="'+entry.id+'"]');
  $("#timeline").querySelectorAll(".open").forEach(e=>e.classList.remove("open"));
  if(li) li.classList.add("open");
  let h = '<h2 id="drawerTitle">'+mark(entry.title)+'</h2>'+
    '<div class="meta"><span>'+mark(entry.dateText)+'</span><span>Not on the globe: this one is life, not work</span></div>';
  (entry.body||[]).forEach(b=> h += '<p'+(isTodo(b)?' class="todo"':'')+'>'+esc(b)+'</p>');
  openDrawer(h);
}

function openSea(id){
  const o = CV.oceans.find(x=>x.id===id);
  let h = '<h2 id="drawerTitle">'+esc(o.name)+'</h2>'+
    '<div class="meta"><span>'+esc(o._span)+'</span><span>'+
    (o._width ? o._width+' months of water' : 'the water before the work')+'</span></div>'+
    '<p'+(isTodo(o.note)?' class="todo"':'')+'>'+esc(o.note)+'</p>'+
    '<p class="sub">Why the water is named</p>'+
    '<p>Every ocean on this globe is an interval between two jobs, named for its width in months first and its content second. The gaps are usually the part of a CV that gets deleted; on a chart they are the largest features, so they get named like features.</p>';
  openDrawer(h);
}

function openLane(l){
  let h = '<h2 id="drawerTitle">'+esc(l.label)+'</h2>'+
    '<div class="meta"><span>'+esc(shortOrg(l.a))+' → '+esc(shortOrg(l.b))+'</span>'+
    '<span>A shipping lane: something that carried over</span></div>'+
    '<p'+(isTodo(l.note)?' class="todo"':'')+'>'+esc(l.note)+'</p>';
  openDrawer(h);
}

/* ==========================================================================
   9. THE LINE
   ========================================================================== */
function buildTimeline(){
  const ol = $("#timeline");
  LINE.forEach(entry=>{
    const li = document.createElement("li");
    li.className = "tl-item";
    li.dataset.kind = entry.kind;
    li.dataset.id = entry.id;
    if(entry.kind==="job" && entry.job.ongoing) li.classList.add("now");

    const a = document.createElement("a");
    a.className = "node";
    a.href = entry.kind==="job" ? "#work-"+entry.id : "#line-"+entry.id;
    a.innerHTML = '<span class="node-date'+(isTodo(entry.dateText)?' node-todo':'')+'">'+esc(entry.dateText)+'</span>'+
      '<span class="node-title'+(isTodo(entry.title)?' node-todo':'')+'">'+esc(entry.title)+'</span>'+
      (entry.org ? '<span class="node-org">'+esc(entry.org)+'</span>' : '');

    const dot = document.createElement("span"); dot.className = "dot";
    const leader = document.createElement("span"); leader.className = "leader";
    /* The bar in the gutter is the same duration the continent is drawn from:
       3px per month, so the line and the globe agree. */
    const bar = document.createElement("span"); bar.className = "bar";
    bar.style.height = entry.kind==="job" ? (10 + entry.months*3.2)+"px" : "0px";

    li.appendChild(bar); li.appendChild(dot); li.appendChild(a); li.appendChild(leader);
    ol.appendChild(li);

    a.addEventListener("click", ev=>{
      if(ev.metaKey||ev.ctrlKey||ev.shiftKey) return;
      ev.preventDefault();
      if(entry.kind==="job") openJob(entry.id); else openLife(entry);
    });
    const on = ()=>{ if(entry.kind==="job"){ light(entry.id,true); turnTo(entry.job._lon, entry.job._lat); } else li.classList.add("lit"); };
    const off = ()=>{ if(entry.kind==="job") light(entry.id,false); else li.classList.remove("lit"); };
    a.addEventListener("pointerenter", on);
    a.addEventListener("pointerleave", off);
    a.addEventListener("focus", on);
    a.addEventListener("blur", off);
  });
}

/* ==========================================================================
   10. COMPASS ROSE — the outbound links as cardinal arms
   ========================================================================== */
function buildRose(){
  const arms = [
    { dir:"N", deg:0,   label:"Email",    href:"mailto:"+CV.contact.email },
    { dir:"E", deg:90,  label:"LinkedIn", href:CV.contact.linkedin },
    { dir:"S", deg:180, label:"GitHub",   href:CV.contact.github },
    { dir:"W", deg:270, label:"Writing",  href:CV.contact.writing }
  ];
  const host = $("#roseArms"), needle = $("#needle");
  const cx = 130, cy = 100, r0 = 38, r1 = 52;
  arms.forEach(a=>{
    const rad = (a.deg-90)*D2R;
    const x0 = cx + Math.cos(rad)*r0, y0 = cy + Math.sin(rad)*r0;
    const x1 = cx + Math.cos(rad)*r1, y1 = cy + Math.sin(rad)*r1;
    const todo = isTodo(a.href);
    const node = el(todo ? "g" : "a", { class:"arm"+(todo?" arm--todo":"") });
    if(!todo){
      node.setAttribute("href", a.href);
      if(/^https?:/.test(a.href)){ node.setAttribute("target","_blank"); node.setAttribute("rel","noopener"); }
      node.setAttribute("aria-label", a.label);
    } else {
      node.setAttribute("role","note");
      node.setAttribute("aria-label", a.label+": "+a.href);
    }
    node.appendChild(el("line",{x1:x0,y1:y0,x2:x1,y2:y1}));
    const t = el("text");
    let tx = x1, ty = y1, anchor = "middle";
    if(a.dir==="N"){ ty = y1-6; }
    if(a.dir==="S"){ ty = y1+12; }
    if(a.dir==="E"){ tx = x1+7; ty = y1+3.5; anchor = "start"; }
    if(a.dir==="W"){ tx = x1-7; ty = y1+3.5; anchor = "end"; }
    t.setAttribute("x",tx); t.setAttribute("y",ty); t.setAttribute("text-anchor",anchor);
    t.textContent = todo ? a.label+" (add)" : a.label;
    node.appendChild(t);
    host.appendChild(node);
    /* the needle swings to whichever link you are pointing at */
    const swing = ()=> needle.setAttribute("transform","rotate("+a.deg+")");
    node.addEventListener("pointerenter", swing);
    node.addEventListener("focus", swing);
    node.addEventListener("pointerleave", ()=>needle.setAttribute("transform","rotate(0)"));
    node.addEventListener("blur", ()=>needle.setAttribute("transform","rotate(0)"));
  });
}

/* ==========================================================================
   10b. TOP-RIGHT SOCIAL LINKS — built from CV.contact
   ========================================================================== */
function buildSocial(){
  const host = $("#social");
  const c = CV.contact;
  const links = [
    { label:"Email",    href:"mailto:"+c.email,   todo:isTodo(c.email) },
    { label:"LinkedIn", href:c.linkedin,           todo:isTodo(c.linkedin) },
    { label:"GitHub",   href:c.github,             todo:isTodo(c.github) }
  ];
<<<<<<< HEAD
  if(c.phone){
    /* local "0330 5800323" display, "+923305800323" tel: link */
    const digits = String(c.phone).replace(/\D/g,"");
    const intl = digits.replace(/^0/, "+92");
    const display = digits.replace(/^0(\d{3})(\d+)$/, "0$1 $2");
    links.push({ label:display, href:"tel:"+intl, todo:isTodo(c.phone), isPhone:true });
  }
=======
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
  links.forEach(l=>{
    const a = document.createElement("a");
    if(l.todo){
      a.href = "#"; a.className = "todo"; a.setAttribute("aria-disabled","true");
      a.textContent = l.label+" (add)";
      a.addEventListener("click", ev=>ev.preventDefault());
    } else {
      a.href = l.href;
      if(/^https?:/.test(l.href)){ a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = l.label;
    }
    host.appendChild(a);
  });
}

/* ==========================================================================
   10b2. EDUCATION, MINI — a compact degree/school/GPA line under the
        social links, with an optional institution logo. A logo path that
        doesn't resolve collapses to no image rather than a broken icon —
        drop the real files in a `logos/` folder to fill them in.
   ========================================================================== */
function buildEducationMini(){
  const host = $("#educationMini");
  if(!host || !(CV.education||[]).length) return;
  let h = "";
  CV.education.forEach(e=>{
    h += '<div class="edu-row">'+
      (e.logo ? '<img class="edu-logo" src="'+esc(e.logo)+'" alt="'+esc(e.school)+' logo">' : '')+
      '<span class="edu-text">'+
        '<span class="edu-degree'+(isTodo(e.degree)?' todo':'')+'">'+esc(e.degree)+'</span>'+
        '<span class="edu-school'+(isTodo(e.school)?' todo':'')+'">'+esc(e.school)+'</span>'+
      '</span>'+
      (e.gpa ? '<span class="edu-gpa">GPA '+esc(e.gpa)+'</span>' : '')+
    '</div>';
  });
  host.innerHTML = h;
  host.querySelectorAll(".edu-logo").forEach(img=>{
    img.addEventListener("error", ()=> img.remove());
  });
}

/* ==========================================================================
   10c. EXPERIENCE — a carousel, one card visible at a time, most recent
        first: location, duration, website, skills tags, a click-to-reveal
        photo, the writeup, projects and references. Tabs, Prev/Next,
        arrow keys and a swipe all move it; the card title still reuses
        openJob() to open the same drawer and turn the globe. focusJob()
        (section 7) calls goToSlide() too, so clicking a job anywhere on
        the page — globe, timeline, or here — brings the carousel along.
   ========================================================================== */
let xpOrder = [], xpIndex = 0;

function goToSlide(idOrIndex, opts){
  opts = opts || {};
  if(!xpOrder.length) return;
  const i = typeof idOrIndex === "number"
    ? ((idOrIndex % xpOrder.length) + xpOrder.length) % xpOrder.length
    : xpOrder.findIndex(j=>j.id===idOrIndex);
  if(i < 0) return;
  xpIndex = i;
  const track = $("#xpTrack");
  track.style.transform = "translateX(-"+(xpIndex*100)+"%)";
  document.querySelectorAll("#xpTabs .xp-tab").forEach((t,ti)=> t.classList.toggle("active", ti===xpIndex));
  const n = xpOrder.length;
  $("#xpCounter").textContent = String(xpIndex+1).padStart(2,"0")+" / "+String(n).padStart(2,"0");
  const activeCard = track.children[xpIndex];
  if(activeCard) $("#xpViewport").style.height = activeCard.offsetHeight+"px";
  if(!opts.silent) focusJob(xpOrder[xpIndex].id);
}

function buildExperience(){
  const host = $("#xpTrack");
  xpOrder = [...JOBS].reverse();
<<<<<<< HEAD
  const TAG_CAP = 5;   // beyond this, collapse into a "+N" chip — the full list is one click away
=======
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
  let h = "";
  xpOrder.forEach(j=>{
    h += '<article class="xp-card" id="xp-'+j.id+'">';
    h += '<button type="button" class="xp-head" data-open="'+j.id+'">'+
      '<span class="xp-role'+(isTodo(j.role)?' node-todo':'')+'">'+esc(j.role)+'</span>'+
      '<span class="xp-org">'+mark(j.org)+'</span></button>';
    h += '<div class="xp-meta"><span>'+mark(j.place)+'</span>'+
      '<span>'+span(j)+' · '+j._months+' months'+(j.ongoing?', ongoing':'')+'</span>'+
      '<span>'+Math.round(j._share*100)+'% of the working life so far</span></div>';

    if(j.website){
      h += isTodo(j.website)
        ? '<p class="xp-website todo">'+esc(j.website)+'</p>'
        : '<a class="xp-website" href="'+esc(j.website)+'" target="_blank" rel="noopener">'+esc(j.website)+' ↗</a>';
    }

    if((j.skills||[]).length){
<<<<<<< HEAD
      const shown = j.skills.slice(0, TAG_CAP), extra = j.skills.length - shown.length;
      h += '<div class="xp-tags">'+shown.map(s=>
        '<span class="xp-tag'+(isTodo(s)?' todo':'')+'">'+esc(s)+'</span>').join("")+
        (extra>0 ? '<span class="xp-tag more" data-open="'+j.id+'">+'+extra+' more</span>' : '')+
        '</div>';
    }

    const teaser = j.notes[0];
    h += '<p class="xp-teaser'+(isTodo(teaser)?' todo':'')+'">'+esc(teaser)+'</p>';
    h += '<button type="button" class="xp-more" data-open="'+j.id+'">Details →</button>';
=======
      h += '<div class="xp-tags">'+j.skills.map(s=>
        '<span class="xp-tag'+(isTodo(s)?' todo':'')+'">'+esc(s)+'</span>').join("")+'</div>';
    }

    if(j.photo && !isTodo(j.photo)){
      h += '<button type="button" class="xp-photo-btn" data-photo="'+j.id+'">Show photo</button>'+
        '<img class="xp-photo" data-img="'+j.id+'" src="'+esc(j.photo)+'" '+
        'alt="'+esc(j.role)+' at '+esc(j.org)+'">';
    } else if(j.photo){
      h += '<p class="xp-website todo">'+esc(j.photo)+'</p>';
    }

    h += '<div class="xp-notes">';
    j.notes.forEach(n=> h += '<p'+(isTodo(n)?' class="todo"':'')+'>'+esc(n)+'</p>');
    h += '</div>';

    if((j.projects||[]).length){
      h += '<p class="xp-sub">Projects</p><ul class="xp-projects">';
      j.projects.forEach(p=>{
        h += '<li><b'+(isTodo(p.name)?' class="todo"':'')+'>'+esc(p.name)+'</b>'+
          '<span'+(isTodo(p.blurb)?' class="todo"':'')+'>'+esc(p.blurb)+'</span>'+
          (p.repo && !isTodo(p.repo) ? '<a href="'+esc(p.repo)+'" target="_blank" rel="noopener">Link</a>' : '')+
          '</li>';
      });
      h += '</ul>';
    }

    if((j.references||[]).length){
      h += '<p class="xp-sub">References</p><ul class="xp-refs">';
      j.references.forEach(r=>{
        h += '<li><b'+(isTodo(r.name)?' class="todo"':'')+'>'+esc(r.name)+'</b>'+
          '<span'+(isTodo(r.role)?' class="todo"':'')+'>'+esc(r.role)+'</span></li>';
      });
      h += '</ul>';
    }
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916

    h += '</article>';
  });
  host.innerHTML = h;

<<<<<<< HEAD
  /* one delegated listener: every card's open-button (head, +N tags, and
     the read-more button all share data-open) sends you to the drawer,
     which is where the full notes, projects, skills, photo and
     references for that job actually live. */
  host.addEventListener("click", ev=>{
    const openBtn = ev.target.closest("[data-open]");
    if(openBtn) openJob(openBtn.dataset.open);
=======
  /* one delegated listener covers every card's open-button and photo-toggle */
  host.addEventListener("click", ev=>{
    const openBtn = ev.target.closest("[data-open]");
    if(openBtn){ openJob(openBtn.dataset.open); return; }
    const photoBtn = ev.target.closest("[data-photo]");
    if(photoBtn){
      const img = host.querySelector('[data-img="'+photoBtn.dataset.photo+'"]');
      if(!img) return;
      const show = !img.classList.contains("show");
      img.classList.toggle("show", show);
      photoBtn.textContent = show ? "Hide photo" : "Show photo";
      requestAnimationFrame(()=> goToSlide(xpIndex, {silent:true}));   // resize for the reveal
    }
  });

  /* a photo path that doesn't resolve collapses to a note instead of a
     broken-image icon */
  host.querySelectorAll(".xp-photo").forEach(img=>{
    img.addEventListener("error", ()=>{
      const btn = host.querySelector('[data-photo="'+img.dataset.img+'"]');
      const note = document.createElement("p");
      note.className = "xp-website todo";
      note.textContent = "Photo not found at "+img.getAttribute("src")+" — check the path in content.js.";
      img.replaceWith(note);
      if(btn) btn.remove();
    });
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
  });

  /* tabs: one per job, short org name, jumps straight to that slide */
  const tabHost = $("#xpTabs");
  tabHost.innerHTML = xpOrder.map((j,i)=>
    '<button type="button" class="xp-tab" data-slide="'+i+'" role="tab">'+esc(shortOrg(j))+'</button>').join("");
  tabHost.addEventListener("click", ev=>{
    const tab = ev.target.closest("[data-slide]");
    if(tab) goToSlide(Number(tab.dataset.slide));
  });

  $("#xpPrev").addEventListener("click", ()=> goToSlide(xpIndex-1));
  $("#xpNext").addEventListener("click", ()=> goToSlide(xpIndex+1));

  const viewport = $("#xpViewport");
  viewport.setAttribute("tabindex","0");
  viewport.addEventListener("keydown", ev=>{
    if(ev.key==="ArrowLeft"){ ev.preventDefault(); goToSlide(xpIndex-1); }
    else if(ev.key==="ArrowRight"){ ev.preventDefault(); goToSlide(xpIndex+1); }
  });

  /* swipe: a plain threshold on total pointer travel, no live drag-follow */
  let swipeStart = null;
  viewport.addEventListener("pointerdown", ev=>{ swipeStart = ev.clientX; });
  viewport.addEventListener("pointerup", ev=>{
    if(swipeStart===null) return;
    const dx = ev.clientX - swipeStart; swipeStart = null;
    if(Math.abs(dx) < 50) return;
    goToSlide(dx < 0 ? xpIndex+1 : xpIndex-1);
  });

  window.addEventListener("resize", ()=> goToSlide(xpIndex, {silent:true}));
  goToSlide(0, {silent:true});
}

/* ==========================================================================
<<<<<<< HEAD
   10d. SKILLS CLOUD — a scattered set of tags, deliberately no ratings.
        Each chip gets a small tilt computed from a hash of its own text,
        so the layout looks hand-placed rather than gridded, but is stable
        across reloads instead of re-randomising every time.
   ========================================================================== */
function buildSkillsCloud(){
  const host = $("#skillsCloud");
  const list = (CV.skills||[]).filter(s=> typeof s==="string" && !isTodo(s));
  if(!host || !list.length) return;
  const hash = s => { let h=0; for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0; return Math.abs(h); };
  host.innerHTML = list.map(s=>{
    const h = hash(s);
    const tilt = (h % 9) - 4;              // -4..4deg, stable per skill
    const alt = (h % 3===0) ? " alt" : "";  // a little colour variety, not a ranking
    return '<span class="skill-chip'+alt+'" style="--tilt:'+tilt+'deg" tabindex="0">'+esc(s)+'</span>';
  }).join("");
=======
   10d. SKILLS RADAR — a spider chart, one axis per skill in CV.skills,
        drawn with the same polar-coordinate approach as the compass rose
        above (angle round a centre, distance out from it), rather than a
        row of plain bars. Hovering a vertex reveals its exact score, and
        a one-line computed summary sits underneath.
   ========================================================================== */
function buildSkillsRadar(){
  const svg = $("#skillsRadar");
  const list = (CV.skills||[]).filter(s=>!isTodo(s.name));
  if(!svg || list.length < 3) return;   // fewer than 3 axes doesn't read as a shape

  const CXR = 230, CYR = 230, RMAX = 168, N = list.length;
  const angleFor = i => (-90 + i*(360/N)) * D2R;
  const pt = (i, frac) => [ CXR + Math.cos(angleFor(i))*RMAX*frac, CYR + Math.sin(angleFor(i))*RMAX*frac ];
  const fx2 = n => n.toFixed(1);

  let h = "";
  [2,4,6,8,10].forEach(ring=>{
    const pts = list.map((_,i)=> pt(i, ring/10).map(fx2).join(",")).join(" ");
    h += '<polygon class="radar-grid'+(ring===10?' outer':'')+'" points="'+pts+'"/>';
  });
  list.forEach((_,i)=>{
    const [x,y] = pt(i,1);
    h += '<line class="radar-axis" x1="'+CXR+'" y1="'+CYR+'" x2="'+fx2(x)+'" y2="'+fx2(y)+'"/>';
  });

  const levels = list.map(s=> Math.max(0, Math.min(10, Number(s.level)||0)));
  const dataPts = list.map((s,i)=> pt(i, levels[i]/10));
  h += '<polygon class="radar-fill" points="'+dataPts.map(p=>p.map(fx2).join(",")).join(" ")+'"/>';

  list.forEach((s,i)=>{
    const ang = angleFor(i), c = Math.cos(ang), sn = Math.sin(ang);
    const [lx,ly] = pt(i,1.16);
    const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
    const dy = sn > 0.3 ? 8 : sn < -0.3 ? -3 : 3;
    h += '<text class="radar-label" text-anchor="'+anchor+'" x="'+fx2(lx)+'" y="'+fx2(ly+dy)+'">'+esc(s.name)+'</text>';

    const [dx,dyy] = dataPts[i];
    h += '<g class="radar-vgroup" tabindex="0">'+
      '<circle class="radar-dot" cx="'+fx2(dx)+'" cy="'+fx2(dyy)+'" r="4"/>'+
      '<text class="radar-vlabel" text-anchor="'+anchor+'" x="'+fx2(dx + (anchor==="start"?8:anchor==="end"?-8:0))+'" y="'+fx2(dyy - 9)+'">'+esc(s.name)+' — '+levels[i]+'/10</text>'+
      '</g>';
  });
  svg.innerHTML = h;

  const avg = (levels.reduce((a,b)=>a+b,0)/levels.length).toFixed(1);
  const maxLevel = Math.max(...levels);
  const top = list.filter((s,i)=>levels[i]===maxLevel).map(s=>s.name);
  const summary = $("#skillsSummary");
  if(!summary) return;
  let text = list.length+' skills tracked · average <b>'+avg+'/10</b>';
  if(top.length < list.length){    // skip the clause if every skill is tied — it isn't informative
    const topText = top.length>1 ? top.slice(0,-1).join(", ")+" and "+top[top.length-1] : top[0];
    text += ' · strongest: <b>'+esc(topText)+'</b>';
  }
  summary.innerHTML = text;
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
}

/* ==========================================================================
   12. GO
   ========================================================================== */
$("#standfirst").innerHTML = CV.standfirst;
<<<<<<< HEAD
if(CV.nameMeaning) $("#nameHint").textContent = CV.nameMeaning;
=======
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
$("#coords").innerHTML = CV.coords.map(s=>'<span>'+esc(s)+'</span>').join("");
$("#footer").innerHTML = 'Drawn by hand. Land area is time; longitude is chronology. '+
  'Last continent measured to '+MONTHS[new Date().getMonth()]+' '+new Date().getFullYear()+'.';

buildSocial();
buildEducationMini();
buildParallels(); buildMeridians(); buildYears(); buildLanes(); buildFeatures();
<<<<<<< HEAD
buildTimeline(); buildRose(); buildExperience(); buildSkillsCloud();
=======
buildTimeline(); buildRose(); buildExperience(); buildSkillsRadar();
>>>>>>> 0371407c01020eeb5fc0147e969961267ebb1916
view.lon0 = JOBS[JOBS.length-1]._lon;    // open on the current job, facing the viewer
draw();
requestAnimationFrame(tick);

/* Anchors coming in from outside (a shared link to #work-ptcl) should turn
   the globe to that job rather than just jumping down the page. */
function fromHash(){
  const m = /^#work-(.+)$/.exec(location.hash);
  if(m && byId[m[1]]) turnTo(byId[m[1]]._lon, byId[m[1]]._lat);
}
window.addEventListener("hashchange", fromHash); fromHash();