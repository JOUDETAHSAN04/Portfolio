/* ==========================================================================
   PORTFOLIO CONTENT — the only file you should need to edit.

   Everything on the page — the intro, the social links, the mini education
   summary, the timeline, the globe, the drawer that opens when you click
   something, the experience section, and the skills meter — is generated
   from this one object. The rendering code lives in app.js and never needs
   to change just because you're adding a job or filling in a gap.

   PAGE LAYOUT, TOP TO BOTTOM
     1. Masthead — your name, a one-line intro (`standfirst`), and, top
        right, the social/contact links (`contact`) and a compact
        education summary with logos and GPA (`education`).
     2. Stage — the timeline (left, starting at your BS and ending at your
        current job) and the globe (right). Hover or click anything on
        either side and the other answers.
     3. Experience — one expandable card per job, in `jobs[]`, most recent
        first: location, duration, website, skills used, a photo toggle,
        the writeup, projects, and references.
     4. Skills — the 0–10 meter, from `skills[]`.

   HOW PLACEHOLDERS WORK
   Any string containing the word ADD is automatically underlined in
   signal yellow wherever it appears on the page. There are none left in
   this file right now — everything below is either real or has been left
   out entirely rather than shown half-filled. If you add a new job or
   section, follow the same rule: either fill it in for real, or omit the
   field so nothing placeholder-shaped shows up on the live page.

   FIELD REFERENCE FOR jobs[]
     id          short unique slug, used in URLs (#work-<id>, #xp-<id>)
                   and internally. Lowercase letters only, no spaces.
     role        job title — the card heading.
     org         company / organisation name.
     place       city, or "Remote".
     from/to     "YYYY-MM" strings. `to` is null and `ongoing:true` if
                   it's your current job — its landmass then grows every
                   month and its card is marked "ongoing".
     months      duration in months. This is what actually drives the
                   landmass area and the timeline bar height — it is used
                   as-is, not auto-computed from from/to, so keep it
                   honest when you change dates.
     lat         latitude of the landmass on the globe, -70..70. This is
                   the only value you choose freely — nudge it if two
                   jobs' landmasses end up overlapping awkwardly.
                   Longitude is computed automatically from `from`.
     seed        any number. Only changes the shape of the coastline.
     website     optional — the company or product's site, "https://...".
                   Omit the field entirely if you don't have one; don't
                   leave a placeholder string in it.
     photo       optional — a path to an image, e.g. "photos/ptcl.jpg"
                   (put the file in a `photos/` folder next to
                   index.html). Shows a "Show photo" button that reveals
                   it on click. Omit the field if you don't have a photo.
     skills      array of short strings — the skills tags shown as pills
                   on the card, e.g. ["Node.js","Postgres","AWS"]. Use []
                   if you'd rather not tag this one.
     references  array of { name, role } — people who can vouch for this
                   job. Only add real people with their permission; use
                   [] otherwise.
     notes       array of paragraphs, the writeup for the card.
     projects    array of { name, blurb, at, repo? }.
                   at is [bearing in degrees 0-360, distance 0-0.75] —
                   placement of the project's pin on the globe.
                   repo is optional — a "https://..." URL (repo, article,
                   product page, whatever) makes the pin, and the card's
                   project entry, a link labelled "Link".

   TO ADD A NEW JOB
   1. Add an entry to the `jobs` array (anywhere — order in the array is
      oldest-first; the experience cards show newest first automatically).
   2. Give it a unique id, real from/to/months, and fill in what you have.
      Fields you don't have data for should be omitted, not left as a
      placeholder string.
   3. Add `{ ref:"your-new-id" },` to the `life` array below, in the
      correct chronological position, so it also appears on the timeline.

   TO ADD A GAP BETWEEN JOBS (an "ocean")
   Add an entry to `oceans` with `after` and `before` set to the ids of the
   two jobs it sits between (or `after:null` for the gap before your first
   job). Name it anything — the convention here is "The <N>-Month <Sea/Strait>".

   TO ADD A LIFE EVENT THAT ISN'T A JOB (move, marriage, birth, etc.)
   Add an entry to `life` with a unique `id`, `kind` of "life" or "edu", a
   `dateText` label, a `title`, and a `body` array of paragraphs — in the
   correct chronological position. The timeline currently starts at your
   BS and ends at your current job — add earlier/later life events back in
   at the start/end of the array if you want them on the page again.

   TO ADD OR CHANGE A SKILL METER
   Edit the `skills` array near the bottom. Each row is
   { name:"React", level:7 } — level is 0-10, a plain number. The names
   below are pulled from your own job entries; the levels are a neutral
   starting guess (5) — only you can rate how good you are at them.

   TO ADD YOUR EDUCATION LOGOS
   Drop the real image files in a `logos/` folder next to index.html and
   point `education[].logo` at them, e.g. "logos/uet.png". A missing file
   just quietly shows no logo rather than a broken image — there's no
   real UET Taxila or NUST logo bundled here, since that isn't something
   that can be generated or fetched on your behalf; add the actual files
   yourself.

   A NOTE ON THE DATES BELOW (2026-09-10)
   PTCL, Bitsol and Asimplify's dates were corrected to match the resume
   text you pasted in, since it lines up exactly end-to-end: PTCL ends
   11/2022, Bitsol runs 10/2022–02/2023, Haidri/PepsiCola starts 02/2023
   (exact), Asimplify runs 05/2023–09/2023, and Taro starts 09/2023
   (exact) — right after Asimplify, no more overlap. If any pasted date
   was itself a typo, fix the from/to/months on that job and everything
   downstream (globe position, timeline, ocean gaps) follows automatically.
   ========================================================================== */
const CV = {
  name: "Jaudet Ahsan",
  standfirst: "A dependable generalist who owns products end-to-end — full-stack build, security baked in, deployment battle-tested, and the leadership instincts to steer a team while doing it.",
  coords: [
    "Lahore, Punjab · 31.5204° N, 74.3587° E",
    "Available for the slow read and the ninety-second skim"
  ],
  contact: {
    email: "joudetahsan@gmail.com",
    linkedin: "https://linkedin.com/in/jaudet-ahsan",
    github: "https://github.com/JOUDETAHSAN04",
    writing: "https://beingpakistaniblogs.wordpress.com/"
  },

  /* ---- work, oldest first. Order here sets the timeline/globe tab order;
     the experience section shows newest first automatically. ------------ */
  jobs: [
    {
      id:"techrecipes", role:"Freelance technical writer", org:"Tech-Recipes, through Upwork",
      place:"Remote; Tel Aviv, Israel", from:"2019-01", to:"2020-02", months:14, lat:34, seed:11,
      website:"https://www.tech-recipes.com/",
      skills:["Technical writing","Networking","Windows","Linux"],
      references:[],
      notes:[
        "Fourteen months of explaining software in plain English, on deadline, to people who were mid-problem. I was paid to write about it before I was paid to write it.",
        "I mostly covered Windows, Linux, Office and networking, plus general how-tos like WhatsApp — filed around 100 pieces in total."
      ],
      projects:[
        {name:"Wireshark packet-reading tutorial", blurb:"Not just a piece I filed — writing it up forced me to actually understand the networking concepts. That kind of research is how I ended up with 120+ published articles, read by millions of people.", repo:"https://www.tech-recipes.com/blog/2020/06/08/how-to-read-data-packet-constituents-in-wireshark/", at:[40,.45]}
      ]
    },
    {
      id:"creative", role:"Social media manager", org:"Creative Solutions Furniture",
      place:"Lahore", from:"2019-09", to:"2020-12", months:16, lat:-26, seed:23,
      website:"https://officerepublic.pk/",
      skills:["Social media management","SEO","SEM","Lead generation","Web design"],
      references:[],
      notes:[
        "Sixteen months running the shopfront for a furniture company. It overlapped the whole of the writing year.",
        "Managed social and ran the ad front — SEO, SEM, lead hunting, lead correspondence and turning enquiries into sales, plus budgeting — and built their website from the ground up. It's now one of the leading office furniture stores in Lahore, with a turnover of roughly 800 million rupees."
      ],
      projects:[
        {name:"Officer Republic — company website", blurb:"Built from the ground up as the official site for Creative Solutions Furniture.", repo:"https://officerepublic.pk/", at:[100,.5]}
      ]
    },
    {
      id:"ptcl", role:"Management trainee, then assistant manager — network operations, then managed security services",
      org:"PTCL / Ufone Group, Summit batch 5", place:"Islamabad",
      from:"2021-11", to:"2022-11", months:12, lat:-18, seed:47,
      website:"https://www.ptcl.com.pk/",
      skills:["Network operations","RCA & performance analysis","Workforce management systems","GIS/NOC integration","Vendor management","Audit & compliance"],
      references:[],
      notes:[
        "The graduate programme, then two assistant manager posts. This is the largest landmass on the globe for most of my career, and it is the one that taught me what an operation is: shifts, escalation paths, a field force, and a number you have to answer for every quarter.",
        "Beyond the three projects below: inventory and installed-base verification, BBR and R&R management, auditing and escalations; identifying potential savings in the O&M department and rental evaluations; consolidating wireless site data for site dismantling and management; and monthly/yearly reporting, working closely with field teams, area managers, managers and WFM solution providers including Jazz and Huawei."
      ],
      projects:[
        {name:"Huawei Autin rollout", blurb:"Ran the rollout with the field maintenance centres, including its integration with the NOC and GIS.", at:[25,.5]},
        {name:"Quarterly network performance reviews", blurb:"Held bi-annual and quarterly performance meetings with PTCL's regional and zonal teams, after deep-dive analysis of networks, latencies and RCAs, compared against vendor reports.", at:[150,.45]},
        {name:"Workforce management onboarding", blurb:"Consolidated PTCL field maintenance centre data, provisioned resources, and onboarded team leads, fibre deployers and fibre patrollers onto the latest Workforce Management solution, driving adoption across the field force.", at:[265,.5]}
      ]
    },
    {
      id:"bitsol", role:"Student intern, Full Stack Bootcamp (MEAN & MERN)", org:"Bitsol Technologies",
      place:"Rawalpindi", from:"2022-10", to:"2023-02", months:4, lat:42, seed:31,
      skills:["MEAN stack","MERN stack","JavaScript","React","Node.js","Express","MongoDB","Tailwind CSS"],
      references:[],
      notes:[
        "Completed an extensive 3000-hour Full Stack Bootcamp covering both MEAN and MERN — front-end work in HTML, CSS, Tailwind CSS and modern frameworks, back-end work in Node.js and Express.",
        "Went deep on JavaScript through both stacks — building ecommerce stores and Node-based projects — and came out of it with a much stronger grip on React."
      ],
      projects:[
        {name:"Bootcamp e-commerce platform", blurb:"The whole cohort forked onto our instructor's project and pushed a huge amount of code onto it — a Shopify-level storefront setup.", at:[190,.4]}
      ]
    },
    {
      id:"haidri", role:"Associate software developer", org:"Haidri Beverages, a PepsiCo franchise",
      place:"Rawalpindi", from:"2023-02", to:"2023-05", months:4, lat:34, seed:59,
      skills:[".NET","SDLC","BRD writing","Reporting & data management","Authentication"],
      references:[],
      notes:[
        "One project taken the whole way: business requirements document through to deployment, in under two months.",
        "Conceptualised and built a .NET-based application for Pepsi's internal audit team — drafted the BRD, then led the end-to-end SDLC, coding, testing and deployment, on the client's own servers.",
        "Implemented core functionality including data management, reporting modules and user authentication for audit processes, coordinating closely with stakeholders to gather requirements and demo progress."
      ],
      projects:[
        {name:"Internal audit management system", blurb:"A .NET application built for Pepsi's internal audit team — BRD to deployment in under two months, covering data management, reporting and authentication.", at:[70,.4]}
      ]
    },
    {
      id:"asimplify", role:"Software engineer", org:"Asimplify", place:"Islamabad",
      from:"2023-05", to:"2023-09", months:4, lat:-22, seed:67,
      website:"https://ticketsonsale.com/",
      skills:["React",".NET / ASP.NET Core","Entity Framework Core","Dapper","REST APIs","Swagger/OpenAPI","Postman"],
      references:[],
      notes:[
        "Four months modernising ticketsonsale.com, an event-ticketing platform: migrated the legacy .NET (Razor/MVC) front end to React, improving load times and responsiveness.",
        "Designed, built and tested the backend ticketing APIs in ASP.NET Core — seat inventory and booking/checkout endpoints — using Entity Framework Core and Dapper for data access, Postman for endpoint testing, and Swagger/OpenAPI for contract-first documentation.",
        "Ran at roughly 45 hours a week, owning timelines, sprints and stakeholder communication alongside the build.",
        "Also took on HR and technical recruitment for Full Stack Developer roles, and some business development — negotiating contracts and advising clients on AI-driven enhancements."
      ],
      projects:[
        {name:"Interactive seating chart", blurb:"A clickable, image-mapped stadium seating chart with real-time seat availability and pricing, replacing a static list-based picker.", at:[100,.45]}
      ]
    },
    {
      id:"taro", role:"Assistant to the chief executive officer", org:"Taro Holdings",
      place:"New York", from:"2023-09", to:"2023-12", months:4, lat:64, seed:73,
      skills:["Google Cloud","Security auditing","Executive support"],
      references:[],
      notes:[
        "Four months beside a chief executive: Google Cloud scripting, scheduling, security auditing, pitch decks. The smallest island here, and the one furthest from everything else on the map."
      ],
      projects:[
        {name:"Google Cloud scripting and scheduling", blurb:"Automated recurring scheduling and admin tasks on Google Cloud for the CEO's office.", at:[300,.4]},
        {name:"Security audit", blurb:"A security audit carried out during the role, alongside the day-to-day scripting and scheduling work.", at:[110,.42]}
      ]
    },
    {
      id:"jazz", role:"Specialist application developer", org:"Jazz", place:"Lahore",
      from:"2024-05", to:"2024-11", months:7, lat:-44, seed:83,
      website:"https://www.jazz.com.pk/",
      skills:["Angular","MEAN stack","Power Automate","Selenium","ServiceNow ITSM","Flow Designer","SLA/OLA management"],
      references:[],
      notes:[
        "My second telecom, this time on the software side of it — building scalable FinTech features for JazzCash on the MEAN stack, with a strong focus on Angular for the front end.",
        "Built omni-channel portals for call centres, integrating KYC and NADRA data behind strict visibility controls to keep the compliance and security bar high.",
        "Used Power Automate and Selenium to build data-migration pipelines out of legacy systems, creating and consuming multiple APIs to keep the data flowing end to end. Also integrated preventive-maintenance features into core systems, improving reliability and cutting operational downtime.",
        "Led the migration of the team's ticketing workflow from Jira to ServiceNow ITSM — redesigned the ticket lifecycle from intake (service catalog, record producers, inbound email actions) through categorisation, SLA-bound assignment and closure. Rebuilt the team structure (assignment groups, roles, approval hierarchies) and replicated Jira's workflow logic in Flow Designer and UI Policies/Client Scripts, debugging platform issues with the Script Debugger, Background Scripts and System Logs along the way."
      ],
      projects:[
        {name:"JazzCash omni-channel portals", blurb:"Secure call-centre portals integrating KYC and NADRA data with strict visibility controls, built on the MEAN stack with an Angular front end.", at:[80,.45]},
        {name:"Jira → ServiceNow ITSM migration", blurb:"Redesigned the end-to-end ticket lifecycle and rebuilt the team's structure in ServiceNow — assignment rules, SLAs/OLAs and Performance Analytics dashboards to match the visibility leadership had on Jira.", at:[250,.4]}
      ]
    },
    {
      id:"technetium", role:"Senior software engineer, AI integrations", org:"Technetium Labs",
      place:"Lahore", from:"2025-02", to:null, ongoing:true, lat:16, seed:97,
      skills:[],
      references:[],
      notes:[
        "Putting models into products: the plumbing, the evaluation, and the part where someone in the business asks whether it can be trusted yet.",
        "This landmass is measured to today, so it grows on its own."
      ],
      projects:[]
    }
  ],

  /* ---- oceans. Each one is an interval between two jobs. ------------------
     The naming convention: a water is named for its width in months first
     and its content second. The gaps in a CV are usually deleted; on a chart
     they are the largest features, so they get named like features. ------- */
  oceans: [
    { id:"longwater", name:"The Long Water", after:null, before:"techrecipes", lat:-8, lon:180,
      note:"Everything before January 2019 — school, both degrees, the years I was not being paid for any of this. It is the largest water on the globe and it sits on the seam, where the map runs out on one side and has not been drawn yet on the other." },
    { id:"eleven1", name:"The Eleven-Month Sea", after:"creative", before:"ptcl", lat:-40,
      note:"December 2020 to November 2021 — most likely when the MS Information Security degree was underway, based on how the dates now line up." },
    { id:"sea5", name:"The Five-Month Sea", after:"taro", before:"jazz", lat:34,
      note:"December 2023 to May 2024." },
    { id:"strait3", name:"The Three-Month Strait", after:"jazz", before:"technetium", lat:-22,
      note:"November 2024 to February 2025." }
  ],

  /* ---- shipping lanes: what carried from one job into the next ----------- */
  lanes: [
    { from:"techrecipes", to:"technetium", label:"Writing",
      note:"A year of writing tutorials, and then years of writing the document before the code." },
    { from:"bitsol", to:"haidri", label:"The MERN stack",
      note:"Bootcamp finished in February 2023, and the developer job at Haidri started that same month — MongoDB, React and Node carried straight over." },
    { from:"ptcl", to:"jazz", label:"Telecom, twice",
      note:"Network operations and managed security services at PTCL/Ufone, then application development at Jazz. Two operators, the same industry, opposite ends of the building." },
    { from:"taro", to:"technetium", label:"Google Cloud",
      note:"Cloud scripting in New York, cloud everything since." }
  ],

  /* ---- the line: BS through to the current job ---------------------------
     Entries with ref: pull a job in. -------------------------------------- */
  life: [
    { id:"bs", kind:"edu", year:null, dateText:"", title:"BS Computer Science",
      body:["University of Engineering and Technology, Taxila. GPA 3.76."] },
    { ref:"techrecipes" },
    { ref:"creative" },
    { ref:"ptcl" },
       { id:"ms", kind:"edu", year:null, dateText:"", title:"MS Information Security",
      body:["National University of Sciences and Technology. GPA 3.80."] },
    { ref:"bitsol" },
    { ref:"haidri" },
    { ref:"asimplify" },
    { ref:"taro" },
    { ref:"jazz" },
    { ref:"technetium" }
  ],

  education: [
    { degree:"BS Computer Science", school:"University of Engineering and Technology, Taxila", gpa:"3.76", logo:"logos/uet.png" },
    { degree:"MS Information Security", school:"National University of Sciences and Technology (NUST)", gpa:"3.80", logo:"logos/nust.png" }
  ],

  /* ---- skills meter, 0-10. Names below are pulled straight from the
     skills tags on your job entries; `level` is a plain number, set it
     yourself. Delete rows you don't want, add as many as you like. ------- */
  skills: [
    { name:"JavaScript / TypeScript", level:5 },
    { name:"React", level:5 },
    { name:"Angular", level:5 },
    { name:".NET / ASP.NET Core", level:5 },
    { name:"Node.js", level:5 },
    { name:"Cloud (Google Cloud / AWS)", level:5 },
    { name:"Network operations", level:5 },
    { name:"Security", level:5 }
  ],

  /* ---- globe tuning ------------------------------------------------------ */
  globe: {
    landFraction: 0.26,   // share of the sphere's surface given to all jobs together
    lonWest: -158,        // longitude of the first job
    lonEast: 142,         // longitude of today
    tilt: 12,             // latitude the camera looks at
    idleSpin: 0.045       // degrees per frame
  }
};
