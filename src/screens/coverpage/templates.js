// BUBT cover-page HTML template engine. Ported verbatim from the CampusOne
// reference (src/screens/coverpage) so both apps emit byte-identical documents.
// Pure string builders — no framework deps. The host calls buildHtml(data) and
// prints the result (window.print on web).
import { BUBT_LOGO_CREST, BUBT_LOGO_HEADER } from "./logos.js";

export const DOC_TYPES = ["assignment", "lab_report", "project_report", "index_page", "internship_report"];
export const TEMPLATES = ["default", "classic", "premium", "minimal", "modern"];
export const TEMPLATE_LABELS = {
  default: "Default Style", classic: "Classic Style", premium: "Premium Style",
  minimal: "Minimal Style", modern: "Modern Style",
};
export const DOC_TYPE_LABELS = {
  assignment: "Assignment", lab_report: "Lab Report", project_report: "Project Report",
  index_page: "Index Page", internship_report: "Internship Report",
};
export const DESIGNATIONS = [
  "Lecturer", "Senior Lecturer", "Assistant Professor", "Assistant Professor & Chairman",
  "Associate Professor", "Professor", "Professor & Chairman", "Professor & Dean",
];
export const hasStyles = (d) => d === "assignment" || d === "lab_report";

const UNI = "Bangladesh University of Business and Technology";
const SANS = "Helvetica, Arial, sans-serif";
const SERIF = "'Times New Roman', Times, serif";

function esc(s) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// YYYY-MM-DD -> MM/dd/yyyy (matches the BUBT Info app output).
export function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? "").trim());
  return m ? `${m[2]}/${m[3]}/${m[1]}` : s;
}

function styleCfg(t) {
  switch (t) {
    case "classic": return { font: SANS, logo: "header", label: "box", round: false, title: false };
    case "premium": return { font: SERIF, logo: "header", label: "underline", round: false, title: false };
    case "minimal": return { font: SERIF, logo: "crest", label: "underline-rule", round: false, title: true };
    case "modern": return { font: SERIF, logo: "crest", label: "box-round", round: true, title: true };
    default: return { font: SANS, logo: "crest", label: "box", round: false, title: true };
  }
}

const CSS = `@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{color:#000;width:210mm;min-height:297mm;padding:10mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{border:1.5px solid #000;width:100%;min-height:277mm;padding:12mm 14mm;display:flex;flex-direction:column;}
.utitle{text-align:center;font-weight:bold;font-size:20px;margin:6px 0 12px;}
.crest{display:block;margin:6px auto 12px;width:150px;height:auto;}
.hdr{display:block;margin:4px auto 16px;width:150mm;max-width:100%;height:auto;}
.lblwrap{text-align:center;margin:6px 0 20px;}
.lblbox{display:inline-block;border:1.5px solid #000;padding:8px 28px;font-weight:bold;font-size:17px;letter-spacing:1px;}
.lblu{font-weight:bold;font-size:18px;text-decoration:underline;letter-spacing:1px;}
.rule{border-bottom:1.5px solid #000;width:62mm;margin:7px auto 0;}
.kv{margin:8px 0 0 8mm;}
.kv .row{font-weight:bold;font-size:15px;margin:6px 0;}
.kv .k{display:inline-block;min-width:128px;}
.boxes{display:flex;gap:10mm;margin-top:12mm;}
.box{flex:1;border:1.5px solid #000;border-radius:6px;padding:10px 14px;min-height:40mm;}
.box .bh{text-align:center;font-weight:bold;font-size:16px;margin-bottom:10px;}
.box .row{font-weight:bold;font-size:14px;margin:6px 0;}
.box .uni{font-weight:normal;font-size:12px;margin-top:4px;}
.box .desig{font-weight:normal;font-style:italic;font-size:12px;margin:2px 0 6px;}
.gap{height:12px;}
.date{text-align:center;font-weight:bold;font-size:15px;margin-top:14mm;}
.ptitle{text-align:center;font-weight:bold;font-size:17px;margin:12px 16mm;}
.cc{text-align:center;font-weight:bold;font-size:14px;margin:4px 0;}
.subh{text-align:center;font-weight:bold;font-size:15px;margin:16px 0 6px;text-decoration:underline;}
.subh2{text-align:center;font-weight:bold;font-size:15px;margin:16px 0 6px;}
.ctr{text-align:center;font-size:14px;margin:3px 0;}
.ctrb{text-align:center;font-weight:bold;font-size:15px;margin:3px 0;}
table.mt{border-collapse:collapse;margin:8px auto;width:80%;}
table.mt th,table.mt td{border:1px solid #000;padding:7px 10px;font-size:13px;text-align:center;}
.ititle{text-align:center;font-size:15px;margin:12px 0;line-height:2;}
.ititle b{font-size:16px;}
.ixtitle{text-align:center;font-weight:bold;font-size:20px;margin:6px 0 16px;}
.ixf{font-size:13px;font-weight:bold;margin:10px 0;}
.ixf u{font-weight:normal;}
table.ix{border-collapse:collapse;width:100%;margin-top:12px;}
table.ix th,table.ix td{border:1px solid #000;font-size:12px;padding:6px 4px;text-align:center;height:26px;}
table.ix td.t{text-align:left;}
.ixfoot{text-align:center;font-size:9px;color:#444;margin-top:auto;padding-top:8mm;}`;

function wrap(cfg, inner) {
  const round = cfg.round ? ".page{border-radius:16px}" : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>${CSS}body{font-family:${cfg.font};}${round}</style></head>
<body><div class="page">${inner}</div></body></html>`;
}

function headerBlock(cfg) {
  if (cfg.logo === "header") return `<img class="hdr" src="${BUBT_LOGO_HEADER}" />`;
  return `${cfg.title ? `<div class="utitle">${esc(UNI)}</div>` : ""}<img class="crest" src="${BUBT_LOGO_CREST}" />`;
}

function labelBlock(cfg, text) {
  if (cfg.label === "underline") return `<div class="lblwrap"><span class="lblu">${text}</span></div>`;
  if (cfg.label === "underline-rule") return `<div class="lblwrap"><span class="lblu">${text}</span><div class="rule"></div></div>`;
  const r = cfg.label === "box-round" ? ' style="border-radius:14px"' : "";
  return `<div class="lblwrap"><span class="lblbox"${r}>${text}</span></div>`;
}

function bodyAssignLab(f) {
  const cfg = styleCfg(f.template);
  const e = esc;
  const kv = f.docType === "lab_report"
    ? `<div class="kv">
        <div class="row"><span class="k">Experiment Date</span>: ${e(f.experimentDate)}</div>
        <div class="row"><span class="k">Experiment No</span>: ${e(f.assignmentNo)}</div>
        <div class="row"><span class="k">Course Title</span>: ${e(f.courseTitle)}</div>
        <div class="row"><span class="k">Course Code</span>: ${e(f.courseCode)}</div>
        <div class="row"><span class="k">Experiment Name</span>: ${e(f.experimentName)}</div>
      </div>`
    : `<div class="kv">
        <div class="row"><span class="k">Assignment No</span>: ${e(f.assignmentNo)}</div>
        <div class="row"><span class="k">Course Code</span>: ${e(f.courseCode)}</div>
        <div class="row"><span class="k">Course Title</span>: ${e(f.courseTitle)}</div>
        ${f.experimentName ? `<div class="row"><span class="k">Topic</span>: ${e(f.experimentName)}</div>` : ""}
      </div>`;

  const boxes = `<div class="boxes">
      <div class="box">
        <div class="bh">Submitted By:</div>
        <div class="row">Name : ${e(f.studentName)}</div>
        <div class="row">ID No : ${e(f.studentId)}</div>
        <div class="row">Intake : ${e(f.intake)}</div>
        <div class="row">Section : ${e(f.section)}</div>
        <div class="row">Program : ${e(f.program)}</div>
      </div>
      <div class="box">
        <div class="bh">Submitted To:</div>
        <div class="row">Name : ${e(f.teacherName)}</div>
        ${f.teacherDesig ? `<div class="desig">(${e(f.teacherDesig)})</div>` : '<div class="gap"></div>'}
        <div class="gap"></div>
        <div class="row">Dept. of ${e(f.dept)}</div>
        <div class="uni">${e(UNI)}</div>
      </div>
    </div>`;

  const date = `<div class="date">Date of Submission : ${e(f.date)}</div>`;
  return wrap(cfg, headerBlock(cfg) + labelBlock(cfg, e(f.docTypeLabel).toUpperCase()) + kv + boxes + date);
}

function bodyProject(f) {
  const cfg = styleCfg("classic"); // header logo, sans, sharp border
  const e = esc;
  const rows = f.members.map((m, i) =>
    `<tr><td>${i + 1}</td><td style="text-align:left">${e(m.name)}</td><td>${e(m.id)}</td></tr>`).join("");
  const inner = `<img class="hdr" src="${BUBT_LOGO_HEADER}" />
    ${labelBlock(cfg, "PROJECT REPORT")}
    <div class="ptitle">${e(f.reportTitle)}</div>
    <div class="cc">Course Title : ${e(f.courseTitle)}</div>
    <div class="cc">Course Code : ${e(f.courseCode)}</div>
    <div class="subh">Submitted to:</div>
    <div class="ctrb">${e(f.teacherName)}</div>
    ${f.teacherDesig ? `<div class="ctr">(${e(f.teacherDesig)})</div>` : ""}
    <div class="ctr">Department of ${e(f.dept)}</div>
    <div class="ctr">${e(UNI)} (BUBT)</div>
    <div class="subh">Submitted by:</div>
    <table class="mt"><tr><th>Sl No</th><th>Name</th><th>ID</th></tr>${rows}</table>
    <div class="ctr" style="margin-top:10px">Intake : ${e(f.intake)}, Section : ${e(f.section)}</div>
    <div class="ctr">${e(f.program)}</div>
    <div class="ctr">${e(UNI)} (BUBT)</div>
    <div class="date">Date of Submission : ${e(f.date)}</div>`;
  return wrap(cfg, inner);
}

function bodyInternship(f) {
  const cfg = styleCfg("default"); // crest, sans, has title
  const e = esc;
  const inner = `<div class="utitle">${e(UNI)} (BUBT)</div>
    <img class="crest" src="${BUBT_LOGO_CREST}" />
    <div class="ititle">Internship Report<br/>on<br/><b>${e(f.reportTitle)}</b></div>
    ${f.company ? `<div class="ctrb" style="margin-bottom:4px">${e(f.company)}</div>` : ""}
    ${f.duration ? `<div class="ctr" style="margin-bottom:6px">Duration: ${e(f.duration)}</div>` : ""}
    <div class="subh2">Supervised By</div>
    <div class="ctrb">${e(f.teacherName)}</div>
    ${f.teacherDesig ? `<div class="ctr">${e(f.teacherDesig)}</div>` : ""}
    <div class="ctr">Department of ${e(f.dept)}</div>
    <div class="ctr">${e(UNI)} (BUBT)</div>
    <div class="subh2">Submitted By</div>
    <div class="ctrb">${e(f.studentName)}</div>
    <div class="ctr">ID: ${e(f.studentId)}</div>
    <div class="ctr">Intake: ${e(f.intake)}</div>
    <div class="ctr">Program: ${e(f.program)}</div>
    <div class="ctr">Section: ${e(f.section)}</div>
    <div class="ctr">Department of ${e(f.dept)}</div>
    <div class="ctr">${e(UNI)} (BUBT)</div>
    <div class="date">Date of Submission : ${e(f.date)}</div>`;
  return wrap(cfg, inner);
}

function bodyIndex(f) {
  const cfg = styleCfg("classic"); // header logo, sans
  const e = esc;
  const ul = (v) => `<u>&nbsp;${e(v) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"}&nbsp;</u>`;
  let rows = "";
  const n = Math.min(Math.max(f.indexRows || 15, 1), 40);
  for (let i = 1; i <= n; i++) {
    rows += `<tr><td>${i}</td><td></td><td class="t"></td><td></td><td></td></tr>`;
  }
  const inner = `<img class="hdr" src="${BUBT_LOGO_HEADER}" />
    <div class="ixtitle">INDEX</div>
    <div class="ixf">Name : ${ul(f.studentName)} &nbsp;&nbsp;&nbsp;&nbsp; ID No : ${ul(f.studentId)}</div>
    <div class="ixf">Intake : ${ul(f.intake)} &nbsp;&nbsp; Section : ${ul(f.section)} &nbsp;&nbsp; Course Code : ${ul(f.courseCode)}</div>
    <div class="ixf">Course Title : ${ul(f.courseTitle)}</div>
    <table class="ix">
      <tr><th style="width:8%">SL</th><th style="width:18%">Date</th><th>Title of Experiment / Topic</th><th style="width:10%">Page</th><th style="width:16%">Remarks</th></tr>
      ${rows}
    </table>
    <div class="ixfoot">Generated by FixIt on ${e(f.date)}</div>`;
  return wrap(cfg, inner);
}

export function buildHtml(f) {
  if (f.docType === "project_report") return bodyProject(f);
  if (f.docType === "internship_report") return bodyInternship(f);
  if (f.docType === "index_page") return bodyIndex(f);
  return bodyAssignLab(f);
}
