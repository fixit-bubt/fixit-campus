# BUBT CSE Faculty — Research Findings

**Crawled:** 2026-06-04
**Primary source:** https://cse.bubt.edu.bd/faculty (rich: contact + research)
**Secondary source:** https://www.bubt.edu.bd/department/department-of-computer-science-engineering/faculty (names/ranks only)
**Structured dataset:** [bubt-cse-faculty.json](./bubt-cse-faculty.json) — 105 records

---

## Headcount (from cse.bubt.edu.bd roster, 105 listed)

| Rank | Count |
|------|------:|
| Professor | 1 |
| Associate Professor | 3 |
| Assistant Professor | 36 |
| Lecturer | 65 |
| **Total active roster** | **105** |
| — of which marked *On Study Leave* | 25 |

> The secondary site (bubt.edu.bd) shows **175 "View Profile" links**, but that count includes lab assistants (9), an office assistant, and an administrative officer, plus what appear to be stale/duplicate entries. It also claims the department is "the largest at BUBT with 3,200+ students and 100+ faculty" and "established in 2005." The 105-person teaching roster is the defensible faculty number.

---

## ⚠️ Conflicts the two official sources do not agree on

1. **Who chairs the department.**
   - `cse.bubt.edu.bd` → **Md. Saifur Rahman** (Assistant Professor), *Chairman (Acting)* — id 15.
   - `bubt.edu.bd` → **Prof. Dr. Md. Ahsan Habib**, *Chairman* (also Acting Dean, Research Graduate School).
   - **Prof. Dr. Md. Ahsan Habib does not appear anywhere in the cse.bubt.edu.bd roster.** One site is stale. This needs a primary confirmation (department office) before being treated as fact. I did **not** invent a record for him.

2. **The lone full Professor.** cse.bubt.edu.bd lists exactly one Professor — **Prof. Dr. A B M Shawkat Ali** (Professor in Data Science) — who also isn't surfaced in the bubt.edu.bd senior list. bubt.edu.bd's only listed Professor is Ahsan Habib. So the two sites disagree on the senior-most faculty entirely.

3. **Headcount** — 105 (cse) vs. "100+ / 175 profile links" (bubt). Reconciled above.

---

## Notable senior / research-active faculty

- **Prof. Dr. A B M Shawkat Ali** — Professor in Data Science; Google Scholar + active GitHub.
- **Dr. Khandoker Nadim Parvez** — Assoc. Prof.; PhD U. Calgary (4.0/4.0); networking / streaming systems.
- **Dr. Muhammad Aminur Rahaman** — Assoc. Prof.; Acting CITO & Acting Dean, Research Graduate School; PhD DU; Bangla Sign Language / CV.
- **Dr. Md. Rajibul Islam** — Assoc. Prof. (on leave); PhD photonics, U. Malaya.
- **Dr. Md. Shafiqul Islam** — Asst. Prof. (PhD holder).
- Several PhD-track lecturers abroad: **Avishek Das** (UT Arlington), **Md. Abu Quwsar Ohi**, **Khan Md. Hasib** (widely cited).

## Dominant research themes (across the dept.)
Machine Learning / Deep Learning (by far the most common), Computer Vision & Image Processing, IoT, NLP, Network Security, Data Mining, Blockchain, HCI, and a Signal/Speech-processing cluster (Samiul Basir, Md. Nahid Hossain).

---

## Data quality notes
- **No room / building / faculty-code data exists on these pages** — those fields are null for everyone. (Where a crawler returned a "faculty_code", it was just the numeric profile id echoed back; I dropped those.)
- Many lecturers have **personal Gmail addresses** rather than `@bubt.edu.bd`, and a cluster use `@iut-dhaka.edu` (IUT alumni) — copied verbatim, not normalized.
- `on_leave` is best-effort from profile text; `null` means the page didn't state it.
- A few profiles (ids 114, 144, 155, 158, 91–99 range) are near-empty placeholder pages — name + rank only.
- Source-of-truth scheme differs per site: cse.bubt.edu.bd uses `/facultydetails/{id}/`; bubt.edu.bd uses `/department/27/faculty/profile/{32xxx}`.
