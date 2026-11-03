# Scope: Comprehensive Studyverse Codebase Audit

## Objective
Thorough audit of the Studyverse codebase following recent modifications (Flashcard removal, 10-slot Gemini/Groq upgrade in AI Career, UI restoration in todo/mylist.html), executing the full test suite in `.venv` (Python 3.11), analyzing backend and frontend code across Todo, Schedule, AI Career, and Account, and compiling a detailed report with root-cause analysis and remediation proposals WITHOUT modifying application source code.

## Audit Targets
1. **Test Suite Execution**: Full pytest execution using `.venv` Python 3.11, collecting all passing tests, failures, errors, and warnings.
2. **Backend & Logic Integrity**: `app.py`, `mailer.py`, session/auth logic, email flows, data synchronization endpoints, error handling.
3. **Recent Changes Audit**:
   - Flashcard removal in backend routes, database models/migrations, navigation links, and frontend assets.
   - AI Career 10-slot Gemini/Groq key rotation & fallback logic in backend/frontend.
   - `todo/mylist.html` UI restoration and CSS/JS integrity.
   - Orphaned imports, broken endpoints, dead asset links.
4. **Frontend Interface & Logic**:
   - Todo module (`todo/mylist.html`, `todo/mylist.js`, `todo/mylist.css`)
   - Schedule module (`schedule/create.html`, related JS/CSS)
   - AI Career module (`career/chat.html`, related JS/CSS)
   - Account module (`account.html`, related JS/CSS)
   - Syntax validation, console errors, dead links, security vulnerabilities (XSS, CSRF, insecure endpoints).

## Working Directory Convention
- `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_1\` (Backend & Pytest)
- `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_2\` (Recent Changes & Orphan Checks)
- `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_3\` (Frontend, Security & Logic)
- `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\auditor_verification\` (Forensic Audit & Change Verifier)

## Output Deliverables
- `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\orchestrator\AUDIT_REPORT.md`: Comprehensive audit report with classified severity, exact file:line references, root cause analysis, and concrete remediation steps.
- Verification confirming 0 bytes of application source code were modified during the audit.
