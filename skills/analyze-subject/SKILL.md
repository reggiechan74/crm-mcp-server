---
name: analyze-subject
description: Comprehensive individual intelligence gathering combining internal sources (Gmail, Limitless recordings, transcripts) with extensive OSINT (LinkedIn, Twitter/X, Substack, Crunchbase, SEC filings, court records). Builds detailed profiles including professional history, digital footprint, network connections, thought leadership, and behavioral patterns. Detects manipulation tactics and red flags. Populates CRM dossiers (tiered folder format with modular intelligence/ subdirectory, and legacy single-file format) AND generates standalone intelligence reports. Use when researching business prospects, interviewers, investors, partners, or evaluating contact trustworthiness.
arguments: subject_name
allowed-tools:
  - mcp__plugin_crm_crm__crm_search
  - mcp__plugin_crm_crm__crm_outline
  - mcp__plugin_crm_crm__crm_read
  - mcp__plugin_crm_crm__crm_update
  - mcp__plugin_crm_crm__crm_log
  - mcp__plugin_crm_crm__crm_connections
  - mcp__plugin_crm_crm__crm_vector_search
  - mcp__plugin_crm_crm__crm_stats
  - mcp__plugin_crm_crm__crm_recent
  - mcp__plugin_crm_crm__crm_audit
  - mcp__plugin_crm_crm__crm_repair
  - mcp__plugin_crm_crm__crm_export
  - mcp__plugin_crm_crm__crm_bulk_update
  - mcp__plugin_crm_crm__crm_create
  - AskUserQuestion
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - Agent
  - WebSearch
  - WebFetch
  - mcp__gmail__search_emails
  - mcp__gmail__read_email
---

# Subject Analysis Command

**Purpose:** Comprehensive individual intelligence gathering combining internal data sources with extensive OSINT to build detailed profiles of professional history, digital footprint, network connections, thought leadership, and behavioral patterns.

## Usage

```
/crm:analyze-subject [Subject Name]
```

**Examples:**
- `/crm:analyze-subject Mike Mogull` - Evaluate business prospect
- `/crm:analyze-subject Ross Bratt` - Update contact intelligence
- `/crm:analyze-subject Daniel Sacks` - Research before meeting
- `/crm:analyze-subject [Interviewer Name]` - Prepare for job interview
- `/crm:analyze-subject [Investor Name]` - Due diligence before pitch

**Research Context Options:**
When running this command, specify the context for tailored output:
- **Prospect** - Potential client or business opportunity
- **Interviewer** - Hiring manager or interview panel member
- **Investor** - Angel investor, VC, or funding source
- **Partner** - Potential business partner or collaborator
- **Client** - Active or prospective consulting client
- **General** - Standard comprehensive analysis

## What This Command Does

When invoked, this command performs comprehensive multi-source intelligence gathering:

### Phase 0: Identity Verification & Disambiguation

**For common names, ALWAYS confirm correct individual before proceeding.**

#### Step 0.1: Initial Identity Confirmation

| Data Point | Value | Source |
|------------|-------|--------|
| Full Legal Name | [Confirm full name] | |
| Current Title | [Job title] | LinkedIn/Company |
| Current Organization | [Company name] | LinkedIn/Company |
| Location | [City, State/Country] | Multiple sources |
| Time Period Known | [When relationship began] | Gmail/CRM |

#### Step 0.2: Disambiguation Protocol (for common names)

If the subject has a common name (John Smith, David Lee, Michael Chen, etc.):

1. **Cross-Reference Multiple Data Points:**
   - Company + Title + Name must all match
   - LinkedIn photo matches known appearance (if met in person)
   - Email domain matches known organization
   - Location consistent with known information

2. **Use Unique Identifiers:**
   - LinkedIn URL (if known)
   - Company email address
   - Phone number
   - Specific project or deal name

3. **Disambiguation Searches:**
   ```
   WebSearch: "[Full Name]" "[Company Name]" "[Title]"
   WebSearch: "[Full Name]" "[City]" "[Industry]"
   WebSearch: "[Full Name]" "[Unique identifier - project/deal]"
   ```

4. **Document Confirmation:**
   ```markdown
   **Identity Confirmation:**
   - Subject: [Name]
   - Confirmed via: [List of matching data points]
   - Disambiguation notes: [How distinguished from others with same name]
   - Confidence: HIGH/MEDIUM/LOW
   ```

**⚠️ STOP if identity cannot be confirmed with HIGH confidence. Ask user for additional identifying information.**

### Phase 1: Internal Data Collection

1. **Gmail Search**
   - Search for all emails to/from the subject
   - Extract communication patterns, tone, and topics
   - Identify key dates and relationship milestones

2. **Limitless Lifelog Search**
   - Search for recordings mentioning the subject
   - Extract meeting transcripts and conversation data
   - Identify verbal patterns and in-person dynamics

3. **Local Transcript Search**
   - Search `04_RELATIONSHIPS/CRM/` for any transcript files (or use `crm_search` MCP tool)
   - Search repository for meeting notes or call analyses
   - Look for existing analysis documents

4. **Web Search (OSINT) - Basic**
   - Search for subject's professional presence (LinkedIn, company bio)
   - Search for news articles, press releases, or public statements
   - Search for company affiliations and business history
   - Search for any public controversies, lawsuits, or regulatory issues
   - Search for professional credentials and claimed qualifications

### Phase 1.5: Digital Footprint Deep Dive

Systematically analyze presence across all major platforms:

#### A. LinkedIn Analysis

| Metric | Finding |
|--------|---------|
| Profile URL | [URL] |
| Connections | [Approximate count: 500+, 1000+, etc.] |
| Activity Level | [Active/Moderate/Inactive - posts per week/month] |
| Content Themes | [Topics they post about] |
| Engagement Style | [How they interact - comments, shares, original content] |
| Endorsements | [Top skills endorsed] |
| Recommendations | [Key recommendations received - from whom, for what] |
| Career Gaps | [Any unexplained gaps in employment history] |

**LinkedIn Search Queries:**
```
WebSearch: "[Subject Name]" site:linkedin.com
WebSearch: "[Subject Name]" "[Company]" LinkedIn
WebFetch: [LinkedIn profile URL if known]
```

#### B. Twitter/X Analysis

| Metric | Finding |
|--------|---------|
| Handle | [@handle] |
| Followers | [Count] |
| Following | [Count] |
| Activity Level | [Tweets per week/month] |
| Content Focus | [Primary topics: industry, politics, personal, etc.] |
| Engagement Style | [Professional, casual, provocative, thought leader] |
| Notable Tweets | [Significant posts revealing values/opinions] |
| Interaction Patterns | [Who they engage with, tone of replies] |
| Red Flags | [Controversial posts, deleted tweets (via archive), ratio'd posts] |

**Twitter/X Search Queries:**
```
WebSearch: "[Subject Name]" site:twitter.com OR site:x.com
WebSearch: "[Subject Name]" Twitter profile
WebSearch: from:[handle] [controversial topic] (if handle known)
```

#### C. Substack/Newsletter Analysis

| Metric | Finding |
|--------|---------|
| Publication Name | [Name and URL] |
| Subscriber Estimate | [If available via Substack Leaderboard or stated] |
| Publishing Frequency | [Weekly/Monthly/Sporadic] |
| Content Themes | [Primary topics covered] |
| Writing Style | [Formal/conversational, length, depth] |
| Notable Posts | [Key articles with links] |
| Audience Engagement | [Comment quality and quantity] |

**Substack Search Queries:**
```
WebSearch: "[Subject Name]" site:substack.com
WebSearch: "[Subject Name]" newsletter
WebSearch: "[Subject Name]" Substack
```

#### D. Medium/Blog Analysis

| Metric | Finding |
|--------|---------|
| Profile/Blog URL | [URL] |
| Publication History | [Number of articles, date range] |
| Top Articles | [Most-read or featured pieces] |
| Content Themes | [Topics and expertise areas] |
| Publications | [External publications they contribute to] |

**Medium/Blog Search Queries:**
```
WebSearch: "[Subject Name]" site:medium.com
WebSearch: "[Subject Name]" blog author
WebSearch: "[Subject Name]" personal website
```

#### E. YouTube Presence

| Metric | Finding |
|--------|---------|
| Channel | [URL if they have one] |
| Appearances | [Interviews, podcasts, conference talks on YouTube] |
| Notable Videos | [Key appearances with links] |
| Presentation Style | [From video observations] |
| Topics | [What they discuss in video format] |

**YouTube Search Queries:**
```
WebSearch: "[Subject Name]" site:youtube.com
WebSearch: "[Subject Name]" interview OR podcast OR keynote
WebSearch: "[Subject Name]" "[Conference Name]" video
```

#### F. GitHub/Technical Presence (if applicable)

| Metric | Finding |
|--------|---------|
| GitHub Profile | [URL] |
| Public Repos | [Count and notable projects] |
| Contribution Activity | [Active/Inactive, recent commits] |
| Technical Focus | [Languages, frameworks, domains] |
| Open Source Involvement | [Contributions to major projects] |

**GitHub Search Queries:**
```
WebSearch: "[Subject Name]" site:github.com
WebSearch: "[Subject Name]" GitHub developer
```

#### G. Other Platforms

- **Instagram** (if public): Professional presence, personal brand consistency
- **Facebook** (if public): Professional page, public posts
- **Threads/Mastodon/Bluesky**: Alternative social presence
- **Personal Website**: Portfolio, about page, blog, services offered
- **Podcast**: Do they host their own podcast?

### Phase 1.6: Thought Leadership Research

Document the subject's intellectual and professional contributions:

#### A. Published Content

| Type | Details |
|------|---------|
| **Books** | [Title, Publisher, Year, Amazon link] |
| **Academic Papers** | [Title, Journal, Year, Google Scholar link] |
| **Whitepapers** | [Title, Publisher, Year] |
| **Industry Articles** | [Publication, Title, Date, URL] |
| **Op-Eds** | [Publication, Topic, Date] |

**Publication Search Queries:**
```
WebSearch: "[Subject Name]" author book
WebSearch: "[Subject Name]" site:scholar.google.com
WebSearch: "[Subject Name]" whitepaper OR "white paper"
WebSearch: "[Subject Name]" Forbes OR "Harvard Business Review" OR TechCrunch
```

#### B. Speaking Engagements

| Event | Role | Topic | Date |
|-------|------|-------|------|
| [Conference Name] | [Keynote/Panel/Workshop] | [Topic] | [Date] |
| ... | ... | ... | ... |

**Speaking Search Queries:**
```
WebSearch: "[Subject Name]" keynote OR speaker OR panelist
WebSearch: "[Subject Name]" "[Conference Name]" 2024 OR 2025
WebSearch: "[Subject Name]" TED OR TEDx
```

#### C. Podcast Appearances

| Podcast | Episode | Topic | Date | Link |
|---------|---------|-------|------|------|
| [Name] | [Episode #/Title] | [Topic] | [Date] | [URL] |
| ... | ... | ... | ... | ... |

**Podcast Search Queries:**
```
WebSearch: "[Subject Name]" podcast guest
WebSearch: "[Subject Name]" site:podcasts.apple.com
WebSearch: "[Subject Name]" site:spotify.com podcast
WebSearch: "[Subject Name]" interview podcast [Industry]
```

#### D. Media Coverage

| Outlet | Type | Topic | Date | URL |
|--------|------|-------|------|-----|
| [News Source] | [Interview/Quote/Feature] | [Topic] | [Date] | [URL] |
| ... | ... | ... | ... | ... |

**Media Search Queries:**
```
WebSearch: "[Subject Name]" interview
WebSearch: "[Subject Name]" quoted OR "according to"
WebSearch: "[Subject Name]" profile OR feature
WebSearch: "[Subject Name]" site:bloomberg.com OR site:wsj.com OR site:ft.com
```

#### E. Thought Leadership Summary

Based on collected data, summarize:
- **Primary Expertise Areas:** [What they're known for]
- **Thought Leadership Style:** [Original thinker, synthesizer, contrarian, etc.]
- **Key Themes/Messages:** [Recurring ideas in their content]
- **Audience:** [Who follows/reads their content]
- **Influence Level:** [Industry thought leader, emerging voice, niche expert, etc.]

### Phase 1.7: Professional Network Mapping

#### A. Board & Advisory Roles

| Organization | Role | Status | Source |
|--------------|------|--------|--------|
| [Company/Org] | [Board Member/Advisor/etc.] | [Current/Former] | [URL] |
| ... | ... | ... | ... |

**Board/Advisory Search Queries:**
```
WebSearch: "[Subject Name]" "board of directors" OR "advisory board"
WebSearch: "[Subject Name]" site:crunchbase.com
WebSearch: "[Subject Name]" advisor startup
```

#### B. Investment Activity (if applicable)

| Company | Investment Type | Stage | Date | Source |
|---------|-----------------|-------|------|--------|
| [Company] | [Angel/VC/etc.] | [Seed/Series A/etc.] | [Date] | [URL] |
| ... | ... | ... | ... | ... |

**Investment Search Queries:**
```
WebSearch: "[Subject Name]" angel investor OR "invested in"
WebSearch: "[Subject Name]" site:crunchbase.com investor
WebSearch: "[Subject Name]" site:angellist.com
WebSearch: "[Subject Name]" portfolio companies
```

#### C. Professional Associations

| Organization | Role | Status |
|--------------|------|--------|
| [Association Name] | [Member/Officer/Chair] | [Current/Former] |
| ... | ... | ... |

**Association Search Queries:**
```
WebSearch: "[Subject Name]" "[Industry Association]" member
WebSearch: "[Subject Name]" professional association OR society
```

#### D. Partnership & Co-Founder History

| Entity | Relationship | Duration | Outcome |
|--------|--------------|----------|---------|
| [Company/Project] | [Co-founder/Partner] | [Dates] | [Success/Failure/Ongoing] |
| ... | ... | ... | ... |

**Partnership Search Queries:**
```
WebSearch: "[Subject Name]" co-founder OR cofounder
WebSearch: "[Subject Name]" partner "[Company Name]"
WebSearch: "[Subject Name]" founded OR launched
```

#### E. Key Relationships & Frequent Collaborators

| Person | Relationship | Context | Strength |
|--------|--------------|---------|----------|
| [Name] | [Colleague/Mentor/Mentee/etc.] | [Where/How connected] | [Strong/Medium/Weak] |
| ... | ... | ... | ... |

**Relationship Search Queries:**
```
WebSearch: "[Subject Name]" "[Potential Connection Name]"
WebSearch: "[Subject Name]" mentor OR mentee
WebSearch: "[Subject Name]" collaborated with OR "working with"
```

### Phase 1.8: Public Records & Due Diligence

#### A. Corporate Registry Filings

| Entity | Role | State/Jurisdiction | Status |
|--------|------|-------------------|--------|
| [Company Name] | [Officer/Director/Agent] | [State] | [Active/Inactive] |
| ... | ... | ... | ... |

**Corporate Registry Searches:**
```
WebSearch: "[Subject Name]" "registered agent" OR "incorporator"
WebSearch: "[Subject Name]" LLC OR Inc OR Corp filings
Note: For detailed filings, check state-specific registries (e.g., Delaware Division of Corporations, California Secretary of State)
```

#### B. SEC Filings (for public company executives)

| Filing Type | Company | Date | Key Information |
|-------------|---------|------|-----------------|
| [10-K/Proxy/Form 4/etc.] | [Company] | [Date] | [Compensation, holdings, etc.] |
| ... | ... | ... | ... |

**SEC Search Queries:**
```
WebSearch: "[Subject Name]" site:sec.gov
WebSearch: "[Subject Name]" SEC filing OR proxy statement
WebSearch: "[Subject Name]" executive compensation "[Public Company]"
```

#### C. Patent & Trademark Filings

| Type | Title/Mark | Number | Date | Status |
|------|------------|--------|------|--------|
| Patent | [Title] | [Number] | [Date] | [Granted/Pending] |
| Trademark | [Mark] | [Number] | [Date] | [Active/Abandoned] |

**IP Search Queries:**
```
WebSearch: "[Subject Name]" site:patents.google.com
WebSearch: "[Subject Name]" inventor patent
WebSearch: "[Subject Name]" trademark USPTO
```

#### D. Court Records & Legal History

| Case | Court | Role | Date | Outcome |
|------|-------|------|------|---------|
| [Case Name/Number] | [Court] | [Plaintiff/Defendant/Witness] | [Date] | [Outcome if resolved] |
| ... | ... | ... | ... | ... |

**Legal Search Queries:**
```
WebSearch: "[Subject Name]" lawsuit OR litigation OR "v."
WebSearch: "[Subject Name]" court case OR legal action
WebSearch: "[Subject Name]" site:courtlistener.com
WebSearch: "[Subject Name]" settlement OR judgment
Note: For federal cases, check PACER. For state cases, check state court websites.
```

#### E. Regulatory Actions & Professional Discipline

| Agency/Board | Action | Date | Outcome |
|--------------|--------|------|---------|
| [Regulatory Body] | [Investigation/Fine/Suspension/etc.] | [Date] | [Resolved/Pending] |
| ... | ... | ... | ... |

**Regulatory Search Queries:**
```
WebSearch: "[Subject Name]" "[Licensing Board]" disciplinary action
WebSearch: "[Subject Name]" SEC enforcement OR FINRA
WebSearch: "[Subject Name]" regulatory action OR investigation
WebSearch: "[Subject Name]" license revoked OR suspended
```

#### F. Academic & Credential Verification

| Credential | Institution | Claimed | Verified | Source |
|------------|-------------|---------|----------|--------|
| [Degree/Certification] | [School/Body] | [Yes] | [Yes/No/Unable] | [URL] |
| ... | ... | ... | ... | ... |

**Credential Verification Queries:**
```
WebSearch: "[Subject Name]" "[University]" alumni OR graduate
WebSearch: "[Subject Name]" "[Certification]" certified OR licensed
WebSearch: "[Subject Name]" "[Professional Body]" member directory
Note: For licensed professions, check official state licensing databases
```

### Phase 2: Pattern Analysis

Analyze collected data for:

#### A. Communication Patterns
- Response time and engagement level
- Tone shifts over time
- Topic initiation patterns
- Follow-through on commitments

#### B. Manipulation Tactic Detection
Using the framework from dossier templates:

| Tactic | What to Look For |
|--------|-----------------|
| **Personal Vulnerability Opening** | Unsolicited personal disclosures before business requests |
| **Character Reframing** | Dismissing concerns as emotional or irrational |
| **Lesson-Learning Positioning** | Using past mistakes to justify current trust requests |
| **Efficiency Framing** | Rushing decisions, discouraging due diligence |
| **Future Optionality Hook** | Verbal promises without written commitment |
| **Information Asymmetry** | Requiring disclosure without reciprocation |
| **Personality Weaponization** | Using disclosed vulnerabilities or assessments against you |

#### C. Cialdini Principle Usage
- **Reciprocity:** Creating obligation through favors
- **Commitment/Consistency:** Leveraging small yeses for big asks
- **Social Proof:** Name-dropping, referencing others
- **Authority:** Credential emphasis, expert positioning
- **Liking:** Flattery, similarity emphasis, rapport building
- **Scarcity:** Time pressure, limited opportunity framing

#### D. Trust Architecture Assessment
- Commitment asymmetry (who risks more?)
- Information asymmetry (who knows more?)
- Verbal vs. written alignment
- Exit flexibility comparison

#### E. Behavioral Warning Signs
From the checklist in dossier templates:
- Communication pattern red flags
- Negotiation behavior concerns
- Relationship dynamics issues
- Business ethics indicators

### Phase 3: Dossier Population

Based on analysis, generate content for:

**For Professional Contacts (Sections X.F-K and I-2) → `intelligence/intelligence-risk.md`:**
- Manipulation Tactics Detection table
- Cialdini Framework assessment
- Trust Architecture analysis
- Deal Structure Asymmetry evaluation
- Behavioral Warning Signs checklist
- **Personality Pattern Screening (I-2):**
  - Dark Triad indicators (Narcissism, Machiavellianism, Psychopathy)
  - Cluster B behavioral patterns
  - Energy Impact Assessment
  - Relationship Pattern Analysis
  - Gut Check Integration
- Counter-Strategy recommendations
- Overall Risk Assessment score (including Personality Risk)

**For Personal Contacts (Sections XII.B and E-2) → `intelligence/intelligence-assessment.md`:**
- Friendship Health Check
- Trust Indicators checklist
- Conflict Pattern analysis
- Boundary assessment
- Risk Assessment (if warranted)
- **Toxic Personality Screening (E-2):**
  - Narcissistic friend patterns
  - Toxic patterns (drama, victim identity, etc.)
  - Energy check and dread test
  - "Would I..." test
  - Toxicity score

**For Family Contacts (Sections XII.C-G) → `intelligence/intelligence-health-check.md`:**
- Relationship Concerns (if any)
- Boundary Management
- Safety/Wellbeing notes (if relevant)
- Support Strategy
- **Toxic Family Dynamics Screening (G):**
  - Impact on nuclear family (Reggie, Janice, Izzy)
  - Problematic family patterns
  - Family narcissism indicators
  - Izzy exposure assessment
  - Boundary status and strategy

### Phase 3.5: Tier Routing (for Tiered Dossiers)

When updating a **tiered dossier** (folder format), route content to the appropriate file.

#### Professional/Personal Dossiers (4-tier structure)

| Content Type | Target File | Section(s) |
|--------------|-------------|------------|
| Last contact date, status updates | INDEX.md | YAML frontmatter, Quick Reference |
| Next actions (immediate) | INDEX.md | Next Actions |
| Contact info updates | profile.md | II. Contact Information |
| Background/career history | profile.md | III. Professional Background |
| Relationship milestones | profile.md | IV. Relationship History |
| Communication preferences | profile.md | V. Communication Preferences |
| Strategic value updates | profile.md | VIII. Strategic Value |
| Psychological profile (VII.A-O) | intelligence/intelligence-profile.md | VII.A-O Psychological & Behavioral Profile |
| DISC/Big Five assessments | intelligence/intelligence-profile.md | VII.A-B |
| Cognitive biases | intelligence/intelligence-profile.md | VII.C |
| Emotional intelligence | intelligence/intelligence-profile.md | VII.D |
| Decision-making patterns | intelligence/intelligence-profile.md | VII.E-G |
| Communication style, stress, values, conflict, transcript analysis | intelligence/intelligence-profile.md | VII.H-O |
| MICE vulnerability | intelligence/intelligence-strategic.md | VII.P |
| Deception baseline | intelligence/intelligence-strategic.md | VII.Q |
| Network influence map | intelligence/intelligence-strategic.md | VII.R |
| Relationship patterns | intelligence/intelligence-strategic.md | VII.S |
| Moral foundations | intelligence/intelligence-strategic.md | VII.T |
| Key intelligence (X.A-E) | intelligence/intelligence-risk.md | X. Key Intelligence |
| Manipulation tactics (X.F-K) | intelligence/intelligence-risk.md | X.F-K |
| Source reliability rating | intelligence/intelligence-risk.md | X.L |
| Threat assessment | intelligence/intelligence-risk.md | X.M |
| Personality screening (I-2) | intelligence/intelligence-risk.md | I-2 section |
| Interaction log entries | log.md | XII. Interaction Log |
| Meeting notes references | log.md | XI. Related Documents |
| Historical observations | log.md | XIV. Intelligence Notes |

#### Family Dossiers (6-tier structure)

Family dossiers use an expanded 6-tier structure with dedicated medical and education files:

| File | Purpose | Contents |
|------|---------|----------|
| INDEX.md | Quick reference | Executive summary, relationship assessment, next actions |
| profile.md | Core identity | Relationship history, interests, quality time preferences |
| medical.md | Health status | Medical conditions, genetics, medications, pharmacogenomics, allergies |
| education.md | Development | School info, developmental milestones, certifications, grades |
| intelligence/intelligence-profile.md | Psychology | Personality, love languages, communication, emotional, stress, cognitive, motivations, conflict, social, needs, psych summary (IV.A-K) |
| intelligence/intelligence-relational.md | Relational dynamics | Influence network, communication authenticity, moral values, relationship history, relationship intelligence, deep insights (IV.L-Q) |
| intelligence/intelligence-health-check.md | Relationship health | Relationship health assessment, action items, warning signs, boundaries, safety, support, toxic screening (XI/XII) |
| log.md | History | Interaction log, notes, memorable quotes, life events |

**Family-Specific Content Routing:**

| Content Type | Target File | Section(s) |
|--------------|-------------|------------|
| Last contact date, status updates | INDEX.md | YAML frontmatter, Quick Reference |
| Next actions (immediate) | INDEX.md | Next Actions |
| Relationship assessment scores | INDEX.md | Relationship Assessment |
| Contact info, emergency contacts | profile.md | II. Contact Information |
| Relationship history/milestones | profile.md | IV. Relationship History |
| Interests, hobbies, preferences | profile.md | V. Interests & Hobbies |
| Quality time preferences | profile.md | VI. Quality Time |
| Health conditions, diagnoses | medical.md | II. Current Health Status |
| Genetic/hereditary factors | medical.md | III. Genetic & Hereditary |
| Medications, dosages | medical.md | IV. Medications |
| Pharmacogenomics data | medical.md | V. Pharmacogenomics |
| Allergies, sensitivities | medical.md | VI. Allergies & Sensitivities |
| Healthcare providers | medical.md | VII. Healthcare Providers |
| School information | education.md | II. Current School |
| Developmental milestones | education.md | III. Developmental Milestones |
| Academic performance/grades | education.md | IV. Academic Performance |
| Certifications, achievements | education.md | V. Certifications & Achievements |
| Learning style, IEP/accommodations | education.md | VI. Learning Profile |
| Psychological profile | intelligence/intelligence-profile.md | IV.A-K Psychological Profile |
| Communication patterns | intelligence/intelligence-profile.md | IV.E Communication Patterns |
| Influence network, authenticity, moral values | intelligence/intelligence-relational.md | IV.L-Q Relational Dynamics |
| Relationship history, relationship intelligence | intelligence/intelligence-relational.md | IV.P-Q |
| Relationship health indicators | intelligence/intelligence-health-check.md | XI. Relationship Health |
| Toxic dynamics screening | intelligence/intelligence-health-check.md | XII. Toxic Family Dynamics |
| Interaction log entries | log.md | XII. Interaction Log |
| Memorable quotes | log.md | XIII. Memorable Quotes |
| Life events timeline | log.md | XIV. Life Events |
| Intelligence notes | log.md | XV. Intelligence Notes |

**Query Routing Keywords (Family):**

| Keywords | Routes To |
|----------|-----------|
| health, medical, medication, allergies, genetics, pharmacogenomics, diagnosis, symptoms, doctor, healthcare | medical.md |
| school, education, development, milestones, grades, learning, IEP, certification, academic, teacher | education.md |
| psychology, personality, communication, bias, cognitive, emotional, stress, motivations | intelligence/intelligence-profile.md |
| influence, authenticity, moral values, relationship history, relationship intelligence | intelligence/intelligence-relational.md |
| relationship health, toxic, boundaries, safety, support, warning signs, action items | intelligence/intelligence-health-check.md |
| interests, hobbies, quality time, preferences, favorites | profile.md |
| history, log, quote, event, interaction, note | log.md |
| summary, status, assessment, next action, overview | INDEX.md |

**For legacy dossiers (single file):** All content goes to the single `.md` file as before.

### Phase 4: Context-Specific Intelligence

Based on the research context specified, generate tailored intelligence:

#### For Interviewers (Job Interview Preparation)

| Intel Category | Details |
|----------------|---------|
| **Interview Style** | [Based on Glassdoor reviews, LinkedIn activity, or known reputation] |
| **Common Questions** | [Questions they typically ask based on patterns or reports] |
| **What They Value** | [Based on their content, background, stated priorities] |
| **Hot Buttons** | [Topics they're passionate about, pet peeves] |
| **Rapport Building** | [Shared connections, interests, talking points] |
| **Recent Activity** | [Recent posts, articles, or news to reference] |

**Preparation Recommendations:**
- Topics to raise proactively: [Based on their interests]
- Questions to ask them: [Based on their expertise/role]
- Red flags to watch for: [Based on behavioral analysis]
- Talking points: [Shared experiences, connections, interests]

#### For Investors (Pitch/Fundraising Preparation)

| Intel Category | Details |
|----------------|---------|
| **Investment Thesis** | [What sectors/stages they invest in] |
| **Typical Check Size** | [Investment amounts from portfolio] |
| **Portfolio Companies** | [Notable investments] |
| **Value-Add** | [How they help portfolio companies - operational, connections, domain] |
| **Deal Breakers** | [What they've said turns them off] |
| **Recent Investments** | [Latest deals to reference] |
| **Decision Timeline** | [Known process and timing] |

**Pitch Recommendations:**
- Angles to emphasize: [Based on thesis alignment]
- Proof points they'll want: [Based on investment style]
- Potential concerns to preempt: [Based on known preferences]
- Social proof to mention: [Mutual connections, portfolio overlap]

#### For Business Partners (Partnership Evaluation)

| Intel Category | Details |
|----------------|---------|
| **Working Style** | [Collaborative preferences from content/reputation] |
| **Past Partnerships** | [History of business relationships and outcomes] |
| **Reputation Among Partners** | [What others have said] |
| **Negotiation Style** | [Based on any available information] |
| **Values Alignment** | [Stated values vs. observed behavior] |
| **Risk Factors** | [Based on due diligence findings] |

**Partnership Recommendations:**
- Structure considerations: [Based on their typical deal patterns]
- Terms to negotiate carefully: [Based on risk factors]
- Trust-but-verify items: [Claims requiring validation]
- Exit strategy considerations: [Based on partnership history]

#### For Prospects/Clients (Sales/Consulting Preparation)

| Intel Category | Details |
|----------------|---------|
| **Decision Authority** | [Role in purchasing/hiring decisions] |
| **Pain Points** | [Based on their content, company challenges] |
| **Budget Indicators** | [Company size, funding, public financials] |
| **Procurement Process** | [Known buying patterns] |
| **Competitive Landscape** | [Other vendors/consultants they use] |
| **Relationship Map** | [Key stakeholders and influencers] |

**Engagement Recommendations:**
- Value proposition framing: [Based on their priorities]
- Case studies to reference: [Relevant to their situation]
- Pricing considerations: [Based on budget indicators]
- Objections to prepare for: [Based on their concerns]

## Execution Instructions

When Claude executes this command:

### Step 1: Locate or Create Dossier

#### 1.1 Check for Existing Dossier

Use the CRM MCP tools to locate the contact:

```
crm_search({ query: "[Subject Name]" })
```

If found, use `crm_outline` to see dossier structure. Set `DOSSIER_FORMAT=tiered`.

#### 1.2 Not Found

If no dossier found via `crm_search`, ask user which category:
- Clients/
- Prospects/
- Colleagues/
- Network/
- Personal/
- Family/

Then create using `crm_create` MCP tool (creates tiered dossier automatically).

#### 1.4 Format Detection Summary

| Check | Result | Action |
|-------|--------|--------|
| Folder with INDEX.md exists | TIERED | Route updates to tier files |
| Single .md file exists | LEGACY | Update single file |
| Neither exists | NEW | Create tiered folder via `crm_create` MCP tool |

### Step 2: Collect Gmail Data

```bash
# Use MCP Gmail tool to search
mcp__gmail__search_emails with query: "from:[subject] OR to:[subject]"
maxResults: 100
```

Parse results for:
- Email dates and frequency
- Subject lines and topics
- Tone indicators
- Key quotes or statements

### Step 3: Collect Limitless Data

```bash
# Search Limitless API for mentions
curl -s "https://api.limitless.ai/v1/lifelogs?limit=50&search=[SUBJECT_NAME]" \
  -H "X-API-Key: $(printenv LIMITLESS_API_KEY)" \
  -o /tmp/limitless_subject.json
```

Extract:
- Meeting dates and durations
- Key transcript excerpts
- Verbal patterns and quotes
- In-person interaction dynamics

### Step 4: Search Local Files and Read Transcripts

```bash
# Search for transcripts or analysis files
Grep for subject name in:
- 04_RELATIONSHIPS/CRM/**/*.txt
- 04_RELATIONSHIPS/CRM/**/*.md
- 01_FINANCIAL/**/[subject related]
- 03_PROFESSIONAL/Meetings/**/*
```

#### 4.1 MANDATORY: Complete Transcript Reading Protocol

**⚠️ CRITICAL: ALL source documents (transcripts, chat logs, meeting notes) MUST be read in their ENTIRETY. Partial reading is UNACCEPTABLE and will result in incomplete/incorrect dossiers.**

**Step 4.1.1: Assess Document Size FIRST**

Before reading ANY content, determine the total document size:

```bash
# Get total line count
wc -l /path/to/transcript.txt

# Example output: 2479 /path/to/transcript.txt
```

**Step 4.1.2: Calculate Required Chunks**

| Document Size | Chunk Strategy | Lines per Chunk |
|--------------|----------------|-----------------|
| 1-500 lines | Single read | All |
| 501-1000 lines | 2 chunks | 500 |
| 1001-2000 lines | 4 chunks | 500 |
| 2001-3000 lines | 6 chunks | 500 |
| 3001+ lines | N chunks | 500 (calculate N = ceil(total/500)) |

**Step 4.1.3: Create Reading Tracker**

Before reading, create a tracking table in your working memory:

```markdown
## Transcript Reading Tracker: [filename]
| Chunk | Lines | Status | Key Findings |
|-------|-------|--------|--------------|
| 1 | 1-500 | PENDING | |
| 2 | 501-1000 | PENDING | |
| 3 | 1001-1500 | PENDING | |
| 4 | 1501-2000 | PENDING | |
| 5 | 2001-2479 | PENDING | |
```

**Step 4.1.4: Systematic Chunk Reading**

Read each chunk sequentially, updating the tracker after each read:

```
Read file_path with offset=0, limit=500    → Mark Chunk 1 COMPLETE
Read file_path with offset=500, limit=500  → Mark Chunk 2 COMPLETE
Read file_path with offset=1000, limit=500 → Mark Chunk 3 COMPLETE
... continue until all chunks COMPLETE
```

**Step 4.1.5: MANDATORY Completion Verification**

After all chunks are read, verify coverage:

```bash
# Confirm final line was read
# The last chunk should include the final line number from wc -l

# Example: For a 2479-line file, verify you read up to line 2479
```

**⚠️ VERIFICATION CHECKPOINT:**
- [ ] Total line count obtained via `wc -l`
- [ ] All chunks read (none marked PENDING)
- [ ] Final line number matches expected total
- [ ] No gaps between chunks (e.g., didn't skip from line 500 to line 1000)

**Step 4.1.6: Document Reading Completion in Final Report**

Include in the final analysis output:

```markdown
**Transcript Reading Verification:**
- File: [filename]
- Total Lines: [N]
- Chunks Read: [X] of [X]
- Coverage: 100% (Lines 1-[N])
- Final Line Confirmed: [Yes/No]
```

#### 4.2 Alternative: Parallel Sub-Agent Chunking (for very large files)

For transcripts exceeding 3000 lines, consider parallel processing:

```
# Launch parallel sub-agents, each reading a segment
Sub-agent 1: Read lines 1-1000, extract findings
Sub-agent 2: Read lines 1001-2000, extract findings
Sub-agent 3: Read lines 2001-3000, extract findings
Sub-agent 4: Read lines 3001-end, extract findings

# Each sub-agent returns structured findings
# Main agent synthesizes all findings
```

**Sub-agent prompt template for chunk reading:**
```markdown
Read the transcript file [PATH] from line [START] to line [END].

Extract and summarize:
1. All mentions of dates, times, events
2. Key topics discussed
3. Decisions made or action items
4. Behavioral observations (tone, patterns)
5. Notable quotes (with timestamps if available)
6. Any red flags or concerns
7. Relationship dynamics indicators

Return a structured summary. Include the EXACT line range you read in your response header.
```

#### 4.3 Common Mistakes to AVOID

| Mistake | Why It's Dangerous | Prevention |
|---------|-------------------|------------|
| Reading only first/last portions | Critical context often in middle sections | Always use chunking protocol |
| Assuming 2000 lines is "enough" | Intelligence can appear anywhere | Complete file size assessment first |
| Skipping "boring" sections | Behavioral patterns require full context | Read everything systematically |
| Not verifying final line | May miss 10-20% of content | Always confirm with `wc -l` |
| Using random sampling | Misses chronological patterns | Sequential chunk reading only |

### Step 5: Web Search (OSINT)

Perform multiple web searches to build a public profile:

```
# Professional presence
WebSearch: "[Subject Name]" LinkedIn profile
WebSearch: "[Subject Name]" [Company Name] bio

# News and public record
WebSearch: "[Subject Name]" [Company/Industry] news
WebSearch: "[Subject Name]" lawsuit OR litigation OR complaint
WebSearch: "[Subject Name]" [Professional credentials claimed]

# Company due diligence (if applicable)
WebSearch: "[Company Name]" reviews complaints
WebSearch: "[Company Name]" BBB OR regulatory action
```

Extract:
- Professional history and employment claims
- Company affiliations and roles
- Public statements that reveal character/values
- Claimed credentials and qualifications
- Any legal or regulatory issues mentioned

### Step 6: Web Search Verification (CRITICAL - INDEPENDENT SUB-AGENT)

**All web search findings MUST be independently verified by a separate sub-agent before inclusion in dossier.**

#### 6.1 Generate Claims Document

Before verification, the primary agent creates a claims file:

```markdown
# Save to: /tmp/[subject_name]_claims_for_verification.md

## Subject: [Full Name]
## Generated: [Timestamp]
## Primary Agent: analyze-subject

---

### Claim 1
- **Statement:** [Exact claim being made]
- **Original Source:** [URL where claim was found]
- **Source Type:** [News/Official/Social/Blog/Forum]
- **Date Found:** [When source was accessed]

### Claim 2
...

### Claim N
...
```

#### 6.2 Launch Independent Verification Sub-Agent

**CRITICAL: The verification agent operates independently and has NO access to the primary agent's context or conclusions.**

```
Agent tool invocation:
- subagent_type: general-purpose
- description: "Verify OSINT claims"
- prompt: See below
```

**Verification Agent Prompt:**

```markdown
You are an independent verification agent. Your ONLY task is to verify claims
made about a subject. You must approach each claim with skepticism and verify
against the stated source AND seek corroborating evidence.

## Input File
Read: /tmp/[subject_name]_claims_for_verification.md

## Your Verification Protocol

For EACH claim in the file:

### 1. Source Verification
- Use WebFetch to access the stated source URL
- Confirm the claim actually appears in the source
- Note if source is no longer available or content differs

### 2. CRAAP Assessment
Rate the source (1-5 scale):
| Criterion | Score | Justification |
|-----------|-------|---------------|
| Currency (How recent?) | | |
| Relevance (Directly about subject?) | | |
| Authority (Credible source type?) | | |
| Accuracy (Can be corroborated?) | | |
| Purpose (Objective or biased?) | | |

**Threshold:** Authority AND Accuracy must be 3+ to proceed.

### 3. Independent Corroboration
Use WebSearch to find corroborating evidence:
- Search: "[Subject Name]" "[Key detail from claim]"
- Search: "[Company/Institution]" "[Subject Name]"
- For credentials: Search official registries/directories

### 4. Contradiction Search
Actively search for contradicting information:
- Search: "[Subject Name]" NOT "[claimed detail]"
- Search alternative versions of claimed facts

### 5. Classification
Assign confidence level:
- VERIFIED: Confirmed by 2+ authoritative sources
- CORROBORATED: Supported by 1 additional source
- UNVERIFIED: Only original source, cannot corroborate
- CONFLICTING: Found contradicting information
- REFUTED: Evidence contradicts the claim
- SOURCE_INVALID: Original source doesn't support claim

## High-Priority Verification (MANDATORY extra scrutiny)
These claim types require attempted official verification:
- Professional licenses → Search licensing body registry
- Educational degrees → Search university records/alumni
- Employment claims → Search company announcements/SEC filings
- Awards/honors → Search awarding organization
- Legal outcomes → Search court records/legal databases

## Output Format

Save verification report to: /tmp/[subject_name]_verification_report.md

```markdown
# Verification Report: [Subject Name]
## Verification Agent ID: [Your agent ID]
## Verification Timestamp: [ISO timestamp]
## Claims Reviewed: [Count]

---

### Claim 1: "[Brief statement]"
| Field | Finding |
|-------|---------|
| Original Source Confirms | Yes/No/Partial/Unavailable |
| CRAAP Score | [Total]/25 (Authority: X, Accuracy: X) |
| Corroborating Sources | [URLs or "None found"] |
| Contradicting Sources | [URLs or "None found"] |
| **Confidence Level** | VERIFIED/CORROBORATED/UNVERIFIED/CONFLICTING/REFUTED |
| **Recommendation** | Include/Include with caveat/Exclude/Flag for follow-up |
| Notes | [Any relevant observations] |

---

### Claim 2: ...

---

## Summary Statistics
- Total Claims: X
- Verified: X
- Corroborated: X
- Unverified: X
- Conflicting: X
- Refuted: X
- Source Invalid: X

## Critical Findings
[List any claims that were REFUTED or had CONFLICTING information]

## Verification Limitations
[Note any sources that were inaccessible, registries that couldn't be searched, etc.]
```

## Important Instructions
- You are INDEPENDENT - do not assume claims are true
- Verify AGAINST the source, not just that a source exists
- Actively look for contradictions, not just confirmations
- If you cannot verify, say so clearly
- Note limitations in your verification ability
```

#### 6.3 Review Verification Report

After sub-agent completes, primary agent:

1. **Read verification report:**
   ```
   Read: /tmp/[subject_name]_verification_report.md
   ```

2. **Apply inclusion rules:**
   | Confidence Level | Action |
   |-----------------|--------|
   | VERIFIED | Include as fact in dossier |
   | CORROBORATED | Include with source citation |
   | UNVERIFIED | Include ONLY with `[UNVERIFIED]` tag and caveat |
   | CONFLICTING | Document discrepancy, add to Risk Assessment |
   | REFUTED | Do NOT include; note in Risk Assessment as deception indicator |
   | SOURCE_INVALID | Do NOT include; flag original source as unreliable |

3. **Escalation for critical findings:**
   - If ANY credential claims are REFUTED → Increase Risk Score by 2
   - If 3+ claims are CONFLICTING → Flag for manual review
   - If primary source misrepresents content → Add to manipulation tactics

#### 6.4 Cleanup

After dossier update, remove temporary files:
```bash
rm /tmp/[subject_name]_claims_for_verification.md
rm /tmp/[subject_name]_verification_report.md
```

### Step 7: Analyze with Sub-Agents

For large data sets, use Agent tool with parallel sub-agents:

```
For each data source:
- Task (subagent_type: general-purpose)
- Prompt: "Analyze [source] for manipulation tactics, red flags, and behavioral patterns per the CRM template framework"
```

### Step 8: Synthesize and Generate

Combine sub-agent analyses into:
1. Summary of key findings
2. Specific content for dossier sections
3. Risk assessment score (1-10)
4. Recommended actions

### Step 9: Update Dossier

#### ⚠️ CRITICAL: Dossier Update Protocol

**NEVER use Write tool to update existing dossiers.** The Write tool overwrites entire files, which will DELETE all existing content not included in the new write.

**ALWAYS use Edit tool** to make surgical updates to dossiers:
- Update YAML frontmatter fields individually
- Add new sections at specific locations
- Append to existing tables/lists
- Enhance existing content while preserving original information

**Write tool may ONLY be used for:**
- Temporary working files (e.g., `/tmp/claims_verification.md`)
- Creating brand new dossiers that don't exist yet (rare - user typically creates blank dossier first)

**Why this matters:** Dossiers accumulate intelligence over time. A single Write operation can destroy months of documented interactions, relationship history, and behavioral observations. Edit preserves existing content while adding new intelligence.

#### Update Procedures

##### 9.1 Determine Format

Check the `DOSSIER_FORMAT` variable set in Step 1:
- `tiered` → Use tiered update procedure (9.2a)
- `legacy` → Use legacy update procedure (9.2b)

##### 9.2a: Update Tiered Dossier

For tiered format, make targeted edits to each file.

**Determine Tier Structure:**
- Check if dossier is in `Family/` category
- If Family: Use 6-tier structure (includes medical.md, education.md)
- If Professional/Personal: Use 4-tier structure

---

**For Professional/Personal Dossiers (4-tier):**

**INDEX.md Updates:**
```
Edit: lastContactDate in YAML frontmatter
Edit: nextActionDate in YAML frontmatter
Edit: Quick Reference table (if metrics changed)
Edit: Next Actions section (immediate actions only)
Edit: Relationship Assessment table (if scores changed)
```

**profile.md Updates:**
```
Edit: Strategic Value Assessment (VIII) if evaluation changed
Edit: Relationship History (IV) if new milestones identified
Edit: Communication Preferences (V) if patterns discovered
```

**intelligence/intelligence-profile.md Updates:**
```
Edit: VII.A-B DISC/Big Five Personality Assessments
Edit: VII.C Cognitive Biases
Edit: VII.D Emotional Intelligence
Edit: VII.E-G Decision-Making Patterns
Edit: VII.H-O Communication style, stress responses, values, conflict patterns, transcript analysis
```

**intelligence/intelligence-strategic.md Updates:**
```
Edit: VII.P MICE Vulnerability Profile
Edit: VII.Q Deception Baseline & Detection
Edit: VII.R Network Influence Map
Edit: VII.S Relationship History Pattern Analysis
Edit: VII.T Moral Foundations Profile
```

**intelligence/intelligence-risk.md Updates:**
```
Edit: X. Key Intelligence (all subsections A-E)
Edit: X.F-K Manipulation Tactics Detection
Edit: X.L Source Reliability Rating
Edit: X.M Threat Assessment Matrix
Edit: I-2 Personality Pattern Screening (or E-2 for Personal)
```

**log.md Updates:**
```
Append: New entry to XII. Interaction Log table
Edit: Quick Stats in header (last contact, total interactions)
Append: Related documents (XI) if new meeting notes created
Append: XIV. Intelligence Assessment Notes with dated observation
```

---

**For Family Dossiers (6-tier):**

**INDEX.md Updates:**
```
Edit: lastContactDate in YAML frontmatter
Edit: nextActionDate in YAML frontmatter
Edit: Quick Reference table (if metrics changed)
Edit: Next Actions section (immediate actions only)
Edit: Relationship Assessment table (if scores changed)
```

**profile.md Updates:**
```
Edit: IV. Relationship History (if milestones identified)
Edit: V. Interests & Hobbies (if new interests discovered)
Edit: VI. Quality Time (if preferences learned)
```

**medical.md Updates:**
```
Edit: II. Current Health Status (conditions, diagnoses)
Edit: III. Genetic & Hereditary (family history patterns)
Edit: IV. Medications (current medications, dosages)
Edit: V. Pharmacogenomics (drug metabolism data)
Edit: VI. Allergies & Sensitivities (allergies, intolerances)
Edit: VII. Healthcare Providers (doctors, specialists)
```

**education.md Updates:**
```
Edit: II. Current School (school name, grade, teachers)
Edit: III. Developmental Milestones (reached milestones)
Edit: IV. Academic Performance (grades, assessments)
Edit: V. Certifications & Achievements (awards, certificates)
Edit: VI. Learning Profile (style, IEP, accommodations)
```

**intelligence/intelligence-profile.md Updates:**
```
Edit: IV.A-K Psychological Profile (personality, love languages, communication, emotional, stress, cognitive, motivations, conflict, social, needs, psych summary)
```

**intelligence/intelligence-relational.md Updates:**
```
Edit: IV.L Influence Network Map
Edit: IV.M Communication Authenticity Indicators
Edit: IV.N Moral Values & Decision Framework
Edit: IV.O Relationship History Pattern Analysis
Edit: IV.P Relationship Intelligence
Edit: IV.Q Deep Insights & Observations
```

**intelligence/intelligence-health-check.md Updates:**
```
Edit: XI. Relationship Health Assessment (indicators, action items, warning signs)
Edit: XII. Toxic Family Dynamics Screening (if concerns identified)
Edit: Boundaries, safety, support strategy
```

**log.md Updates:**
```
Append: New entry to XII. Interaction Log table
Edit: Quick Stats in header (last contact, total interactions)
Append: XIII. Memorable Quotes (notable quotes with dates)
Append: XIV. Life Events (significant life events)
Append: XV. Intelligence Notes with dated observation
```

##### 9.2b: Update Legacy Dossier

For legacy format (single file), continue existing behavior:

Use Edit tool to update the single dossier file with:
- Populated manipulation detection sections (X.F-K)
- Filled-in personality screening (I-2)
- Psychological profile updates (VII)
- Risk scores and threat assessment
- Key quotes with dates
- Recommended next steps
- New interaction log entry

## Output Format

When complete, provide TWO outputs:

### 1. Summary Report (In-Conversation)

```markdown
## Analysis Complete: [Subject Name]
**Research Context:** [Interviewer/Investor/Partner/Prospect/Client/General]
**Research Date:** [YYYY-MM-DD]

### Identity Confirmation
- **Full Name:** [Name]
- **Current Title:** [Title]
- **Current Organization:** [Company]
- **Location:** [City, State/Country]
- **Identity Confidence:** HIGH/MEDIUM/LOW

### Data Sources Analyzed
| Source Type | Count | Date Range |
|-------------|-------|------------|
| Gmail | X emails | [date range] |
| Limitless | X recordings | [date range] |
| Local Files | X documents | [date range] |
| Web Search | X searches | N/A |
| Digital Platforms | X platforms found | N/A |

### Transcript/Source Document Reading Verification
| File | Total Lines | Chunks Read | Coverage | Final Line Confirmed |
|------|-------------|-------------|----------|---------------------|
| [filename1.txt] | [N] | [X]/[X] | 100% | ✓ Yes |
| [filename2.md] | [N] | [X]/[X] | 100% | ✓ Yes |

### Web Search Verification Summary (Independent Agent)
- Claims submitted for verification: X
- Verified (2+ sources): X
- Corroborated (1 additional source): X
- Unverified (included with caveat): X
- Conflicting (flagged for follow-up): X
- Refuted (excluded, added to risk assessment): X
- Source Invalid (excluded): X

### Digital Footprint Summary
| Platform | Presence | Activity Level | Key Observations |
|----------|----------|----------------|------------------|
| LinkedIn | [URL] | [Active/Moderate/Inactive] | [Brief note] |
| Twitter/X | [@handle] | [Active/Moderate/Inactive] | [Brief note] |
| Substack | [URL or N/A] | [Frequency] | [Brief note] |
| YouTube | [Present/Absent] | [Appearances/Channel] | [Brief note] |
| Personal Site | [URL or N/A] | N/A | [Brief note] |

### Thought Leadership Profile
- **Primary Expertise:** [Areas]
- **Publications:** [Count and type]
- **Speaking/Podcasts:** [Count and notable appearances]
- **Influence Level:** [Industry thought leader/Emerging voice/Niche expert/Limited presence]

### Professional Network Summary
- **Board/Advisory Roles:** [Count and notable ones]
- **Investment Activity:** [Active investor/Occasional/None]
- **Key Affiliations:** [Notable associations or partnerships]

### Key Findings
1. [FINDING 1]
2. [FINDING 2]
3. [FINDING 3]

### Behavioral Analysis Summary
- **Manipulation Tactics Detected:** [None/Low/Moderate/High concern]
- **Cialdini Techniques:** [Primary techniques observed]
- **Trust Architecture:** [Favorable/Neutral/Concerning]
- **Personality Risk Indicators:** [None/Low/Moderate/High]

### Risk Assessment: [SCORE]/10 - [RISK LEVEL]

| Risk Category | Score | Notes |
|---------------|-------|-------|
| Professional Credibility | X/10 | [Brief note] |
| Behavioral Red Flags | X/10 | [Brief note] |
| Relationship Risk | X/10 | [Brief note] |
| **Overall Risk** | **X/10** | **[RISK LEVEL]** |

### Context-Specific Intelligence ([Interviewer/Investor/Partner/etc.])
[Include the relevant context-specific section based on research context]

### Recommendation: [PROCEED / CAUTION / RESTRUCTURE / DECLINE]
[Brief explanation of recommendation]

### Files Updated

**Dossier Format:** [Tiered/Legacy]
**Tier Structure:** [4-tier (Professional/Personal) / 6-tier (Family)]

#### For Tiered Dossiers (Professional/Personal - 4 files + intelligence/ subdirectory):
- **INDEX.md:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname]/INDEX.md`
  - Updated: lastContactDate, nextAction, Quick Reference
- **profile.md:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname]/profile.md`
  - Updated: [sections if any changed]
- **intelligence/intelligence-profile.md:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname]/intelligence/intelligence-profile.md`
  - Updated: VII.A-O (Personality, Communication, Cognitive, Emotional, Stress, Values, Conflict, Transcript Analysis)
- **intelligence/intelligence-strategic.md:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname]/intelligence/intelligence-strategic.md`
  - Updated: VII.P-T (MICE, Deception, Network Influence, Relationship History, Moral Foundations)
- **intelligence/intelligence-risk.md:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname]/intelligence/intelligence-risk.md`
  - Updated: X (Key Intel, Manipulation, Source Reliability, Threat Assessment), I-2 (Personality Screening)
- **log.md:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname]/log.md`
  - Added: 1 interaction log entry, assessment notes

#### For Tiered Dossiers (Family - 6 files + intelligence/ subdirectory):
- **INDEX.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/INDEX.md`
  - Updated: lastContactDate, nextAction, Quick Reference, Relationship Assessment
- **profile.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/profile.md`
  - Updated: Relationship History, Interests, Quality Time
- **medical.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/medical.md`
  - Updated: Health Status, Medications, Allergies, Healthcare Providers
- **education.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/education.md`
  - Updated: School Info, Milestones, Academic Performance, Learning Profile
- **intelligence/intelligence-profile.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/intelligence/intelligence-profile.md`
  - Updated: IV.A-K (Personality, Love Languages, Communication, Emotional, Stress, Cognitive, Motivations, Conflict, Social, Needs, Psych Summary)
- **intelligence/intelligence-relational.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/intelligence/intelligence-relational.md`
  - Updated: IV.L-Q (Influence Network, Communication Authenticity, Moral Values, Relationship History, Relationship Intelligence, Deep Insights)
- **intelligence/intelligence-health-check.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/intelligence/intelligence-health-check.md`
  - Updated: XI/XII (Relationship Health, Action Items, Warning Signs, Boundaries, Safety, Support, Toxic Screening)
- **log.md:** `04_RELATIONSHIPS/CRM/Family/[LASTNAME]_[Firstname]/log.md`
  - Added: Interaction log entry, Memorable Quotes, Life Events, Notes

#### For Legacy Dossiers:
- **CRM Dossier:** `04_RELATIONSHIPS/CRM/[Category]/[LASTNAME]_[Firstname].md`
  - Sections updated: [LIST]

**Standalone Report:** [PATH TO INTELLIGENCE REPORT]

### Notable Quotes
> "[QUOTE]" - [DATE/SOURCE]
> "[QUOTE]" - [DATE/SOURCE]

### Action Items
- [ ] [ACTION 1]
- [ ] [ACTION 2]
- [ ] [ACTION 3]

### Intelligence Gaps & Follow-Up Needed
- [What couldn't be found or verified]
- [Areas requiring direct conversation to clarify]
```

### 2. Standalone Intelligence Report (Saved to File)

In addition to updating the CRM dossier, save a comprehensive standalone report:

**File Location:** `Agent_Reports/intelligence-analyst/[LASTNAME]_[Firstname]_Individual_Intelligence_[YYYY-MM-DD_HH-MM-SS_EST].md`

**Alternative Location (if no Agent_Reports folder):** `/Intelligence_Reports/[LASTNAME]_[Firstname]_Individual_Intelligence_[YYYY-MM-DD].md`

The standalone report should include:
1. Complete identity confirmation details
2. Full professional history timeline
3. Complete digital footprint analysis (all platforms)
4. Full thought leadership profile with links
5. Complete professional network mapping
6. Public records and due diligence findings
7. Full communication style analysis
8. Complete behavioral pattern analysis
9. Context-specific intelligence (full version)
10. All sources consulted with URLs and reliability ratings
11. Complete intelligence gaps and confidence assessment

**Report Metadata (YAML Front Matter):**
```yaml
---
title: Individual Intelligence Report - [Subject Name]
generatedBy: analyze-subject
date: YYYY-MM-DD
timestamp: YYYY-MM-DD_HH-MM-SS_EST
researchContext: [Interviewer/Investor/Partner/Prospect/Client/General]
category: Intelligence
keywords: [osint, individual-intelligence, subject-name, context]
shareable: false
riskAssessment: X/10
recommendation: [PROCEED/CAUTION/RESTRUCTURE/DECLINE]
dossierPath: [path to CRM dossier if updated]
lastUpdated: YYYY-MM-DD_HH-MM-SS_EST
---
```

**⚠️ IMPORTANT: If the Transcript Reading Verification table shows anything other than 100% coverage with Final Line Confirmed = Yes, the analysis is INCOMPLETE and must be corrected before finalizing.**

## When to Use This Command

**Best Suited For:**

| Research Context | Use Case |
|------------------|----------|
| **Interviewer** | Preparing for job interviews - understand interviewer's style, values, and hot buttons |
| **Investor** | Due diligence before pitch meetings - understand thesis, portfolio, and deal preferences |
| **Partner** | Evaluating potential business partners - assess working style, track record, and risks |
| **Prospect** | Qualifying potential clients - understand needs, budget indicators, and decision process |
| **Client** | Deep dive on existing clients - relationship intelligence and expansion opportunities |
| **General** | Comprehensive analysis for any professional contact |

**Specific Scenarios:**
- Evaluating new business prospects before engagement
- Preparing for important meetings with unfamiliar contacts
- Job interview preparation (researching hiring managers, panel members)
- Investor pitch preparation (understanding fund thesis and preferences)
- Partnership due diligence (before signing agreements)
- Reviewing contacts after concerning interactions
- Updating dossiers with accumulated intelligence
- Preparing for negotiations or difficult conversations
- Annual relationship reviews
- Background checks on potential collaborators or clients

**Not Needed For:**
- Close trusted relationships (unless specific concerns arise)
- Routine contact updates (use `/crm` instead)
- Simple CRM maintenance
- Quick lookups (use `/crm` for existing dossier info)

## Related Skills

- `/crm` - View and update contact dossiers
- `/limitless` - Access meeting recordings directly

---

**Skill Version:** 3.0
**Created:** 2026-01-17
**Updated:** 2026-02-23
**Author:** Intelligence Analyst System
**Changelog:**
- v3.0: **Modular Intelligence Subdirectory Support** - Aligned with CRM V2.1 modular refactor. Intelligence data is now stored in an `intelligence/` subdirectory with 3 pre-split files instead of a single `intelligence.md`:
  - **Professional** (Adversaries, Advisors, Clients, Colleagues, Mentors, Network, Prospects): `intelligence-profile.md` (VII.A-O), `intelligence-strategic.md` (VII.P-T), `intelligence-risk.md` (X, I-2)
  - **Family**: `intelligence-profile.md` (IV.A-K), `intelligence-relational.md` (IV.L-Q), `intelligence-health-check.md` (XI/XII)
  - **Personal**: `intelligence-profile.md` (V.A-J), `intelligence-assessment.md` (XII.B), `intelligence-relational.md` (XII.C)
  - Updated Phase 3 to note target intelligence subfiles for each contact category
  - Updated Phase 3.5 content routing tables to map all sections to correct intelligence subfiles
  - Updated Family tier overview table to show 3 intelligence subfiles instead of single intelligence.md
  - Updated Family query routing keywords to route to specific intelligence subfiles
  - Updated Step 9.2a update procedures to split intelligence updates across 3 subfiles for both Professional/Personal and Family
  - Updated Output Format "Files Updated" to list individual intelligence subfiles
- v2.6: **Family 6-Tier Support** - Extended tiered dossier support to handle Family's expanded 6-tier structure:
  - Phase 3.5 now documents two tier structures: Professional/Personal (4-tier) and Family (6-tier)
  - Added Family tier overview table showing all 6 files: INDEX, profile, medical, education, intelligence, log
  - Added Family-specific content routing table for medical.md and education.md
  - Added Query Routing Keywords table for Family dossiers (routes health/medical keywords to medical.md, school/education to education.md)
  - Step 9.2a now includes separate update instructions for Family 6-tier dossiers
  - Output format "Files Updated" section now shows both 4-file and 6-file variants
- v2.1: **Tiered Dossier Support** - Skill now detects and supports both folder-based tiered dossiers and legacy single-file dossiers:
  - Added Step 1 format detection (checks for folder with INDEX.md vs single .md file)
  - Added Phase 3.5: Tier Routing table mapping content types to appropriate tier files
  - Updated Step 9 with separate update procedures for tiered (9.2a) and legacy (9.2b) formats
  - Tiered updates route to: INDEX.md (status), profile.md (background), intelligence.md (psychology/intel), log.md (interactions)
  - Updated output format to show per-file updates for tiered dossiers
  - New dossiers created via `crm_create` MCP tool in tiered format by default
- v2.0: **MAJOR EXPANSION** - Comprehensive OSINT overhaul integrating osint-person agent capabilities:
  - Added Phase 0: Identity Verification & Disambiguation protocol for common names
  - Added Phase 1.5: Digital Footprint Deep Dive (LinkedIn, Twitter/X, Substack, Medium, YouTube, GitHub, personal sites)
  - Added Phase 1.6: Thought Leadership Research (publications, speaking, podcasts, media coverage)
  - Added Phase 1.7: Professional Network Mapping (board roles, investments, associations, partnerships)
  - Added Phase 1.8: Public Records & Due Diligence (SEC filings, patents, court records, credential verification)
  - Added Phase 4: Context-Specific Intelligence for Interviewers, Investors, Partners, Prospects/Clients
  - Enhanced output format with digital footprint summary, thought leadership profile, network summary
  - Added standalone intelligence report generation (saved to Agent_Reports/intelligence-analyst/)
  - Added research context parameter for tailored analysis
  - Expanded "When to Use" with research context table and specific scenarios
  - Updated description to reflect comprehensive individual intelligence gathering capabilities
- v1.6: **CRITICAL UPDATE** - Added Dossier Update Protocol prohibiting Write tool for dossier updates. Edit tool MUST be used for all dossier modifications to prevent data loss. Write permitted only for temp files and new dossier creation.
- v1.5: **CRITICAL UPDATE** - Added mandatory transcript reading protocol with verification. Includes: (1) Required `wc -l` file size assessment before reading, (2) Chunking strategy table (500 lines per chunk), (3) Reading tracker template, (4) Completion verification checklist, (5) Output format now requires Transcript Reading Verification table showing 100% coverage, (6) Common mistakes to avoid section, (7) Parallel sub-agent chunking option for 3000+ line files
- v1.4: Verification step now uses independent sub-agent to verify claims against sources; added claims document generation, verification agent prompt, report review workflow, and escalation rules for refuted/conflicting claims
- v1.3: Added comprehensive web search verification step (CRAAP framework, cross-reference protocol, information classification, credential verification requirements)
- v1.2: Added web search (OSINT) capability for public profile building, credential verification, and due diligence
- v1.1: Updated to include Personality Pattern Screening (Dark Triad, Cluster B) for all template types
