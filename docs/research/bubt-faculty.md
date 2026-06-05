# BUBT University-Wide Faculty — Research Findings

**Crawled:** 2026-06-04
**University:** Bangladesh University of Business and Technology (BUBT), Mirpur, Dhaka

## Datasets
- [bubt-cse-faculty.json](./bubt-cse-faculty.json) — CSE (105), from the richer `cse.bubt.edu.bd` subdomain
- [bubt-faculty-all.json](./bubt-faculty-all.json) — the other 12 departments (306 teaching faculty), from `www.bubt.edu.bd`
- [bubt-cse-faculty.md](./bubt-cse-faculty.md) — CSE-specific findings (incl. the chairman conflict)

---

## Scope: 13 departments across 5 faculties

| # | Department | Branch | Chairman / Head | Teaching faculty | Support staff |
|---|-----------|--------|-----------------|-----------------:|--------------:|
| 1 | Computer Science & Engineering | Engineering | Md. Saifur Rahman *(Acting)* — disputed¹ | 105 | — |
| 2 | Electrical & Electronic Engineering | Engineering | Prof. Dr. Ahmed Al Mansur | 68 | 8 |
| 3 | Civil Engineering | Engineering | Prof. Dr. Syed Abdul Mofiz | 32 | 6 |
| 4 | Textile Engineering | Engineering | Mohammad Mahmudur Rahman Khan | 29 | 7 |
| 5 | Data Science & Engineering | Engineering | Dr. Md. Rajibul Islam | 8² | — |
| 6 | Management | Business | Thawhidul Kabir | 25 | — |
| 7 | Accounting | Business | Dr. Kazi Naeema Binte Faruky | 16 | — |
| 8 | Marketing | Business | Omar Faruck Ansari | 12 | — |
| 9 | Finance | Business | Md. Sayeem Bin Hafiz | 11 | — |
| 10 | Mathematics & Statistics | Science | Dr. Md. Abdul Hye | 22 | — |
| 11 | Law & Justice | Law | Ariful Islam | 18 | — |
| 12 | English | Arts & Humanities | Md. Reza Hassan Khan | 44 | 1 |
| 13 | Economics | Social Sciences | Md. Mahmudul Hassan | 21 | 1 |
| | **TOTAL** | | | **411** | **31** |

**~411 teaching faculty university-wide** (plus ~31 support/lab/office staff catalogued separately).

¹ **CSE chairman is unresolved** — `cse.bubt.edu.bd` says Md. Saifur Rahman (Acting); `bubt.edu.bd` says Prof. Dr. Md. Ahsan Habib, who is absent from the CSE roster. See the CSE report. (Note: Ahsan Habib does not appear in *any* of the 13 department rosters crawled.)

² **Data Science overlaps CSE.** The 8 Data Science faculty are cross-appointed CSE staff (Aminur Rahaman, Rajibul Islam, Shawkat Ali, Shahiduzzaman, Itisha Nowrin, Ahmed Shafkat, Humayra Ferdous, Md. Nahid Hossain). So the count of unique individuals is roughly **403**, not 411.

---

## Notable findings

- **The Vice-Chancellor teaches.** Prof. Dr. A B M Shawkat Ali (Machine Learning / SVM, PhD Monash) is listed under both CSE and Data Science; his Data-Science profile email is `vc@bubt.edu.bd` — i.e. he is the **VC**, and the sole full Professor in CSE.
- **Engineering dominates headcount** — CSE + EEE + Civil + Textile = 234 of 411 (~57%). EEE alone (68) is the second-largest department after CSE.
- **English is unexpectedly large (44)** and notably interdisciplinary: it houses Bangla-literature, History, and Political-Science lecturers in addition to ELT/English-literature staff.
- **Dominant research clusters by branch:**
  - *Engineering:* ML/AI, renewable energy & power electronics, photonics/optical sensing, signal processing.
  - *Business:* HRM, entrepreneurship (esp. women's entrepreneurship), corporate governance, sustainability.
  - *Math & Stats:* mathematical biology / epidemic modeling, fuzzy mathematics, applied statistics.
  - *Economics:* development economics, poverty/inequality, environmental & health economics.

---

## Data quality / caveats
- **CSE is the only department with a dedicated subdomain.** EEE/Civil/Textile subdomains 302-redirect to a 404; everyone else is main-site only. So CSE has Google Scholar/ResearchGate/LinkedIn links; the other 12 departments do not.
- **No phone numbers** are published on the main-site profiles (only a couple show the BUBT switchboard line), so `phone` is omitted from `bubt-faculty-all.json`. **Email is the available contact field.**
- **Email domains are mixed** — many staff use personal Gmail/Yahoo rather than `@bubt.edu.bd`; an IUT-alumni cluster uses `@iut-dhaka.edu`. Copied verbatim, not normalized.
- **~25 profiles are empty placeholder templates** (name + rank only, `email: null`) — concentrated in EEE (11), Textile (4), English (5), Management (3), Marketing (2).
- **One data anomaly flagged:** Management lists "Md. Farid Hossain Talukdar" twice (Asst. Professor + Lecturer); likely a duplicate record. English's Md. Shirazur Rahman shows a `@gmail` address where a `@bubt` one is expected. Both copied as-shown.
- Counts of "teaching faculty" include academic-adjacent ranks (Demonstrator, Teaching Assistant in EEE); pure lab/office/technical staff are in each department's `staff` array.
