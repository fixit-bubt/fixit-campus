// chat — AI chatbot proxy (Google Gemini). Keeps the Gemini API key server-side;
// the app never sees it. Requires a valid Supabase user JWT (default edge
// function auth gate — no anonymous calls).
//
// Grounds the bot in real campus data via Gemini function calling: bus routes,
// prayer times, lost & found, clubs, rides, routine files, events, blood
// requests, and jobs are looked up live from the DB instead of guessed. DB
// reads run as the CALLING USER (their JWT + anon key, not the service role)
// so Postgres RLS applies exactly as it does everywhere else in the app —
// e.g. lost_found_items is student-only by policy, so a staff/admin asking
// the bot about it correctly gets nothing back.
//
// Required secret (dashboard -> Edge Functions -> Secrets):
//   GEMINI_API_KEY  - from aistudio.google.com/apikey
// Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY.
//
// CORS: this file is deployed identically for both the CampusOne mobile app
// and the fixit-campus web app (same Supabase project, one function serves
// both — see fixit-campus's own memory notes on this). React Native's fetch
// doesn't enforce CORS, so the original mobile-only version of this function
// never needed it and never hit the gap. Browsers do enforce it — before
// letting page JS send a cross-origin request with an Authorization header,
// the browser first sends an OPTIONS preflight and refuses to send the real
// request unless the server answers it with the right Access-Control-*
// headers. Without that, every browser call fails before this code even
// runs, surfacing client-side as a generic "failed to fetch". The ONLY
// change from the original is the CORS_HEADERS constant, the OPTIONS branch,
// and spreading CORS_HEADERS into every Response's headers below — none of
// the chat/tool-calling logic itself is touched.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are the CampusOne assistant for BUBT (Bangladesh University of Business & Technology) students. Be concise and helpful.

You have tools to look up live bus schedules, prayer times, lost & found posts, clubs, rides, class/exam routine files, campus events, blood donation requests, job/internship postings, and the faculty directory — use them instead of guessing when asked. When asked who a department's chairman/head is, call get_faculty with chairmanOnly=true and department set, not a name search. If a tool returns no results, say so plainly rather than inventing an answer; lost & found is student-only data, so if a non-student account gets an empty result, mention that it's restricted to students rather than implying nothing exists. Routine lookups return uploaded PDF/image files per department/semester/section, not a per-course class-time schedule — point the user to the file rather than inventing a specific class time you don't actually have.

For CGPA questions you can calculate directly — you don't need a tool for this. The grading scale is: A+ =4.00, A=3.75, A- =3.50, B+ =3.25, B=3.00, B- =2.75, C+ =2.50, C=2.25, D=2.00, F=0.00. CGPA = sum(credit × grade point) / sum(credit). Show the math when it helps.

For anything else you don't have a tool for, tell the user to check the relevant tab in the app instead of guessing.

The user can attach a photo to their message — e.g. a homework problem, lecture slide, or notice board. Look at it and help directly (explain, solve, transcribe, summarize) rather than asking them to describe it in text instead.`;

// flash-lite over flash: same tool-calling + vision support, much higher
// free-tier RPM/RPD — matters here since one user turn can cost 2-3 calls
// (MAX_TOOL_ROUNDS below) and the key is shared across every student.
const GEMINI_MODEL = 'gemini-flash-lite-latest';
const MAX_TOOL_ROUNDS = 3;
const MAX_IMAGE_BASE64_CHARS = 6_000_000; // ~4.5MB binary — generous for a compressed photo

interface HistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface Payload {
  message: string;
  history?: HistoryTurn[];
  imageBase64?: string;
  imageMimeType?: string;
}

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_bus_routes',
        description: 'Look up active BUBT campus bus routes, optionally filtered by area/stop name. Returns route code, name, area, bus number, helper contact, days it runs, and departure times to/from campus.',
        parameters: {
          type: 'object',
          properties: {
            area: { type: 'string', description: 'Optional area or stop name to filter by (partial match), e.g. "Mirpur"' },
          },
        },
      },
      {
        name: 'get_prayer_times',
        description: "Look up today's Azan and Jamaat times for all five daily prayers plus Jummah, as configured by campus admin.",
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'get_lostfound_items',
        description: 'Search open Lost & Found posts. Student-only data — returns empty for non-student accounts.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['Lost', 'Found'], description: 'Filter to lost or found items only' },
            category: { type: 'string', enum: ['Personal', 'Electronics', 'Documents', 'Other'] },
            query: { type: 'string', description: 'Free-text match against the item title, e.g. "wallet"' },
          },
        },
      },
      {
        name: 'get_clubs',
        description: 'Search active campus clubs by category or name.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['Tech', 'Cultural', 'Sports', 'Professional', 'Social'] },
            query: { type: 'string', description: 'Free-text match against the club name or tagline, e.g. "robotics"' },
          },
        },
      },
      {
        name: 'get_rides',
        description: 'Look up upcoming shared-ride offers to or from campus.',
        parameters: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['To Campus', 'From Campus'] },
            date: { type: 'string', description: 'ISO date (YYYY-MM-DD) to filter to; omit for all upcoming rides' },
          },
        },
      },
      {
        name: 'get_routines',
        description: 'Look up uploaded class or exam routine files by department/semester/section. Returns file metadata and a link, not individual class times.',
        parameters: {
          type: 'object',
          properties: {
            routineType: { type: 'string', enum: ['class', 'exam'] },
            department: { type: 'string', description: 'Partial match, e.g. "CSE"' },
            semester: { type: 'string' },
            section: { type: 'string' },
          },
        },
      },
      {
        name: 'get_events',
        description: 'Look up upcoming campus events, optionally filtered by category or a text search on the title.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['Academic', 'Cultural', 'Sports', 'Club', 'Career'] },
            query: { type: 'string', description: 'Free-text match against the event title' },
          },
        },
      },
      {
        name: 'get_blood_requests',
        description: 'Look up active blood donation requests, optionally filtered by blood group.',
        parameters: {
          type: 'object',
          properties: {
            bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
          },
        },
      },
      {
        name: 'get_jobs',
        description: 'Look up open (non-expired) job and internship postings.',
        parameters: {
          type: 'object',
          properties: {
            jobType: { type: 'string', enum: ['internship', 'part_time', 'full_time'] },
            query: { type: 'string', description: 'Free-text match against the job title, e.g. "developer"' },
          },
        },
      },
      {
        name: 'get_faculty',
        description: 'Search the BUBT faculty directory by name or department, or look up a department\'s chairman. Returns designation, email, phone (CSE only), office/leave status.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text match against the teacher\'s name, e.g. "Rahman"' },
            department: { type: 'string', description: 'Department name, partial match, e.g. "CSE" or "Computer Science"' },
            chairmanOnly: { type: 'boolean', description: 'Set true when the user asks who the chairman/head of a department is — filters to just the chairman instead of the full faculty list. Combine with department.' },
          },
        },
      },
    ],
  },
];

// LIKE/ILIKE metacharacters in user-supplied search text must be escaped so a
// literal % or _ doesn't turn into a wildcard (same rule as messagesService).
function escLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Pulls the "sub" (user id) claim straight out of the already-gateway-verified
// JWT — no signature check needed here since Supabase's edge function
// gateway already rejected anything invalid before this code ever runs.
function userIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payloadB64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadB64));
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

async function supaGet(supabaseUrl: string, anonKey: string, authHeader: string, path: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  });
  if (!res.ok) throw new Error(`supabase query failed: ${res.status}`);
  return res.json();
}

const RATE_LIMIT_MAX = 6; // user turns per RATE_LIMIT_WINDOW_MS, per user
const RATE_LIMIT_WINDOW_MS = 60_000;

// Reuses chatbot_messages (already logged by the client for history) as the
// rate-limit ledger — no separate table needed. RLS scopes this to the
// caller's own rows already, same as every other tool read.
async function recentUserMessageCount(supabaseUrl: string, anonKey: string, authHeader: string): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/chatbot_messages?select=id&role=eq.user&created_at=gte.${encodeURIComponent(since)}`,
    { method: 'HEAD', headers: { apikey: anonKey, Authorization: authHeader, Prefer: 'count=exact' } },
  );
  if (!res.ok) return 0; // fail open — a broken count check shouldn't block chat entirely
  const range = res.headers.get('content-range'); // "*/N"
  return range ? parseInt(range.split('/')[1] ?? '0', 10) || 0 : 0;
}

async function runTool(
  name: string, args: Record<string, unknown>, supabaseUrl: string, anonKey: string, authHeader: string,
) {
  const get = (path: string) => supaGet(supabaseUrl, anonKey, authHeader, path);
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (name === 'get_bus_routes') {
    const area = str(args.area);
    const filter = area ? `&area=ilike.*${encodeURIComponent(escLike(area))}*` : '';
    const rows = await get(
      `bus_routes?select=id,name,area,bus_no,helper_name,helper_phone,days,to_departures,from_departures&active=eq.true${filter}&limit=10`,
    );
    return { routes: rows };
  }

  if (name === 'get_prayer_times') {
    const rows = await get(`prayer_times?select=key,en,azan,jamaat&order=sort`);
    return { prayer_times: rows };
  }

  if (name === 'get_lostfound_items') {
    const type = args.type === 'Lost' || args.type === 'Found' ? args.type : '';
    const category = str(args.category);
    const query = str(args.query);
    let filter = `&status=eq.Open`;
    if (type) filter += `&type=eq.${encodeURIComponent(type)}`;
    if (category) filter += `&category=eq.${encodeURIComponent(category)}`;
    if (query) filter += `&title=ilike.*${encodeURIComponent(escLike(query))}*`;
    const rows = await get(
      `lost_found_items?select=code,type,title,category,location,item_date,status${filter}&order=created_at.desc&limit=10`,
    );
    return { items: rows };
  }

  if (name === 'get_clubs') {
    const category = str(args.category);
    const query = str(args.query);
    let filter = `&is_active=eq.true`;
    if (category) filter += `&category=eq.${encodeURIComponent(category)}`;
    if (query) filter += `&or=(name.ilike.*${encodeURIComponent(escLike(query))}*,tagline.ilike.*${encodeURIComponent(escLike(query))}*)`;
    const rows = await get(`clubs?select=name,tagline,category,about${filter}&order=name.asc&limit=10`);
    return { clubs: rows };
  }

  if (name === 'get_rides') {
    const direction = args.direction === 'To Campus' || args.direction === 'From Campus' ? args.direction : '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(str(args.date)) ? str(args.date) : '';
    const today = new Date().toISOString().slice(0, 10);
    let filter = `&date=gte.${date || today}`;
    if (date) filter = `&date=eq.${date}`;
    if (direction) filter += `&direction=eq.${encodeURIComponent(direction)}`;
    const rows = await get(
      `rides?select=code,direction,vehicle,origin,destination,date,time,seats_total,fare,recurring${filter}&order=date.asc,time.asc&limit=10`,
    );
    return { rides: rows };
  }

  if (name === 'get_routines') {
    const routineType = args.routineType === 'class' || args.routineType === 'exam' ? args.routineType : '';
    const department = str(args.department);
    const semester = str(args.semester);
    const section = str(args.section);
    let filter = '';
    if (routineType) filter += `&type=eq.${encodeURIComponent(routineType)}`;
    if (department) filter += `&department=ilike.*${encodeURIComponent(escLike(department))}*`;
    if (semester) filter += `&semester=eq.${encodeURIComponent(semester)}`;
    if (section) filter += `&section=eq.${encodeURIComponent(section)}`;
    const rows = await get(
      `routines?select=type,title,department,semester,intake,section,file_url,image_url,created_at${filter}&order=created_at.desc&limit=5`,
    );
    return { routines: rows };
  }

  if (name === 'get_events') {
    const category = str(args.category);
    const query = str(args.query);
    const today = new Date().toISOString().slice(0, 10);
    let filter = `&date=gte.${today}`;
    if (category) filter += `&category=eq.${encodeURIComponent(category)}`;
    if (query) filter += `&title=ilike.*${encodeURIComponent(escLike(query))}*`;
    const rows = await get(
      `events?select=title,category,organizer,date,time,end_time,venue,description,capacity${filter}&order=date.asc,time.asc&limit=10`,
    );
    return { events: rows };
  }

  if (name === 'get_blood_requests') {
    const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const bloodGroup = groups.includes(args.bloodGroup as string) ? (args.bloodGroup as string) : '';
    // Match the app's own feed rules exactly (bloodService.getBloodFeed):
    // hide fulfilled requests, age out anything older than 21 days.
    const staleCutoff = new Date(Date.now() - 21 * 86400000).toISOString();
    let filter = `&fulfilled_at=is.null&created_at=gte.${encodeURIComponent(staleCutoff)}`;
    if (bloodGroup) filter += `&blood_group=eq.${encodeURIComponent(bloodGroup)}`;
    const rows = await get(
      `blood_requests?select=code,blood_group,units,patient,hospital,area,urgency,created_at${filter}&order=created_at.desc&limit=10`,
    );
    return { blood_requests: rows };
  }

  if (name === 'get_jobs') {
    const jobType = ['internship', 'part_time', 'full_time'].includes(args.jobType as string) ? (args.jobType as string) : '';
    const query = str(args.query);
    const today = new Date().toISOString().slice(0, 10);
    let filter = `&deadline=gte.${today}`;
    if (jobType) filter += `&job_type=eq.${encodeURIComponent(jobType)}`;
    if (query) filter += `&title=ilike.*${encodeURIComponent(escLike(query))}*`;
    const rows = await get(
      `jobs?select=title,company,job_type,work_mode,location,stipend,deadline,apply_method,apply_value${filter}&order=deadline.asc&limit=10`,
    );
    return { jobs: rows };
  }

  if (name === 'get_faculty') {
    const query = str(args.query);
    const department = str(args.department);
    const chairmanOnly = args.chairmanOnly === true;
    let select = 'name,designation,email,phone,on_leave,is_chairman';
    let filter = '';
    if (query) filter += `&name=ilike.*${encodeURIComponent(escLike(query))}*`;
    if (chairmanOnly) filter += `&is_chairman=eq.true`;
    if (department) {
      select += ',departments!inner(name)';
      filter += `&departments.name=ilike.*${encodeURIComponent(escLike(department))}*`;
    } else {
      select += ',departments(name)';
    }
    const rows = await get(`faculty?select=${select}${filter}&order=name.asc&limit=10`);
    return { faculty: rows };
  }

  return { error: `unknown tool: ${name}` };
}

// Streams a single round from Gemini and yields each chunk's response JSON as
// it arrives (SSE: "data: {...}\n\n" frames). Function-call parts come back
// whole in one chunk (Gemini doesn't fragment call args like it does text),
// so callers can react to a functionCall the moment it shows up.
async function* streamGemini(apiKey: string, contents: unknown[]) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools: TOOLS,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    },
  );
  if (!res.ok || !res.body) {
    // 429 here is Gemini's own free-tier quota (shared across every user of
    // the app, separate from our per-user rate limit above) — a normal,
    // expected condition under load, not a real failure, so it gets a plain
    // message instead of surfacing Google's verbose quota-docs error text.
    if (res.status === 429) throw new Error('The assistant is getting a lot of requests right now — please wait a bit and try again.');
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.error?.message ?? `gemini request failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Normalize CRLF to LF first — Gemini's SSE stream uses \r\n line
    // endings, and a raw \n\n search never matches \r\n\r\n frame
    // boundaries, so every chunk would collect into `buf` forever and no
    // round would ever produce a reply. Safe to do globally: real \r\n bytes
    // only appear as protocol framing here, never inside the JSON payload
    // (escaped \r\n in a JSON string is the two literal characters
    // backslash-r/backslash-n, not actual CR/LF bytes).
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const jsonStr = dataLine.slice(5).trim();
      if (!jsonStr) continue;
      try {
        yield JSON.parse(jsonStr);
      } catch {
        // malformed/partial frame — skip rather than crash the whole round
      }
    }
  }
}

Deno.serve(async (req) => {
  // Browser preflight — see the CORS comment at the top of this file.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'Gemini not configured' }), { status: 500, headers: CORS_HEADERS });
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    // The gateway already verified this JWT before invoking us — forward it
    // as-is so DB reads run as the calling user and RLS applies normally.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS_HEADERS });

    // Student-only feature — checked server-side, not just hidden in the UI,
    // since this endpoint is directly callable by any authenticated user
    // regardless of what the app's nav shows them.
    const uid = userIdFromJwt(authHeader);
    if (!uid) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS_HEADERS });
    const [me] = await supaGet(supabaseUrl, anonKey, authHeader, `profiles?select=role&id=eq.${uid}&limit=1`);
    if (me?.role !== 'student') {
      return new Response(JSON.stringify({ error: 'The AI assistant is available to students only.' }), { status: 403, headers: CORS_HEADERS });
    }

    const p = (await req.json()) as Payload;
    const message = (p?.message ?? '').trim();
    const imageBase64 = typeof p?.imageBase64 === 'string' ? p.imageBase64 : '';
    const imageMimeType = typeof p?.imageMimeType === 'string' ? p.imageMimeType : '';
    const hasImage = !!(imageBase64 && imageMimeType);
    if (!message && !hasImage) return new Response(JSON.stringify({ error: 'message or image required' }), { status: 400, headers: CORS_HEADERS });
    if (message.length > 4000) return new Response(JSON.stringify({ error: 'message too long (max 4000 chars)' }), { status: 400, headers: CORS_HEADERS });
    if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) return new Response(JSON.stringify({ error: 'image too large' }), { status: 400, headers: CORS_HEADERS });

    const recentCount = await recentUserMessageCount(supabaseUrl, anonKey, authHeader);
    if (recentCount >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: "You're sending messages too fast — wait a moment and try again." }),
        { status: 429, headers: CORS_HEADERS },
      );
    }

    // Client-supplied history is untrusted — this endpoint is callable by any
    // authenticated user directly, not just through the app. Drop malformed
    // entries rather than letting a bad role/oversized text 400 the Gemini call.
    const history = (Array.isArray(p.history) ? p.history : [])
      .filter((h): h is HistoryTurn =>
        (h?.role === 'user' || h?.role === 'model') && typeof h?.text === 'string' && h.text.length > 0 && h.text.length <= 4000)
      .slice(-20);

    // Only the CURRENT turn's image is sent to Gemini — past images in
    // history aren't re-fetched and re-attached on every later message, to
    // keep request size and latency bounded as a conversation grows.
    const currentParts: any[] = [];
    if (hasImage) currentParts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
    if (message) currentParts.push({ text: message });

    const contents: any[] = [
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: currentParts },
    ];

    // Everything past this point streams to the client as our own small SSE
    // protocol: {type:'chunk',text} appends text live as it's generated;
    // {type:'retract'} means the text shown so far in this round turned out
    // to be a tool-call round after all (rare — a little preamble before the
    // model decided to call a tool) and must be discarded, not shown as the
    // answer; {type:'done',text} is the final, complete reply; {type:'error'}
    // is a mid-stream failure. HTTP status is always 200 once this starts —
    // errors can't change the status after headers are sent, so they're
    // signaled in-band instead.
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          let finalText = '';
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            let roundText = '';
            const functionCalls: any[] = [];
            for await (const json of streamGemini(apiKey, contents)) {
              const parts = json?.candidates?.[0]?.content?.parts ?? [];
              for (const part of parts) {
                if (part.functionCall) {
                  functionCalls.push(part);
                } else if (typeof part.text === 'string' && part.text) {
                  roundText += part.text;
                  // Only forward live once we know this round hasn't turned
                  // into a tool call — a functionCall part, if any, always
                  // arrives as its own complete part, never interleaved
                  // character-by-character with text the way token text is.
                  if (functionCalls.length === 0) send({ type: 'chunk', text: part.text });
                }
              }
            }

            if (functionCalls.length > 0) {
              if (roundText) send({ type: 'retract' }); // discard whatever preamble text was shown live
              const modelParts = [...(roundText ? [{ text: roundText }] : []), ...functionCalls];
              contents.push({ role: 'model', parts: modelParts });
              const responseParts = [];
              for (const fc of functionCalls) {
                const { name, args } = fc.functionCall;
                let result: unknown;
                try {
                  result = await runTool(name, args ?? {}, supabaseUrl, anonKey, authHeader);
                } catch (e) {
                  result = { error: String(e) };
                }
                responseParts.push({ functionResponse: { name, response: result } });
              }
              // NOTE: despite older Gemini docs showing role: "function" for
              // tool results, the live API rejects it ("Role 'function' is
              // not supported") — confirmed against the deployed model.
              // "user" is what it accepts.
              contents.push({ role: 'user', parts: responseParts });
              continue;
            }

            finalText = roundText;
            break;
          }

          if (!finalText) send({ type: 'error', message: 'no response from model' });
          else send({ type: 'done', text: finalText });
        } catch (e) {
          send({ type: 'error', message: String(e) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', ...CORS_HEADERS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS_HEADERS });
  }
});
