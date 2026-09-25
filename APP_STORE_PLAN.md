# Shipping XO Space to the App Store

Status on 25 September 2026: the `XOSpace` target is a native SwiftUI sample of the Space dashboard (Projects, Agents, Inbox, Setup). It runs on iPhone and iPad simulators with fictional data. It already has a bundle ID (`builders.xo.space`), a 1024px app icon without alpha, a privacy manifest and the export-compliance key.

It cannot be submitted as it is:
- It shows no real data and has no sign-in, and Apple rejects apps built around placeholder content.
- This Mac cannot produce an accepted upload. See "Build tools" in section 3.

## 1. Decisions to make first

| Decision | Recommendation | Why |
|---|---|---|
| What v1 does | A companion for **hosted spaces**: sign in with an XO account, pick a space, see projects, todos, agent sessions, usage and the Inbox, and get notified when something needs you | A self-hosted Space runs on a laptop's localhost, which a phone cannot reach; hosted spaces already have accounts and a server |
| Where data comes from | A small read API in XO Swarm that proxies to each space with server-side credentials, authenticated by the user's Clerk token | The operator `XO_API_KEY` must never ship inside the app (the same rule the web clients follow) |
| Sign-in | Clerk's iOS SDK against the existing Clerk instance, plus Sign in with Apple if Google, GitHub or another social login can create the account | Guideline 4.8 |
| Money | Free app; nothing sold, priced or linked for purchase inside it; plans stay on the web | Guideline 3.1.3(f) allows a free companion with no purchase call to action; outside-app purchase links are legal only on the US storefront, and their fees are still in court |
| Name | App name "XO Space". Subtitle in the public language guide's voice, for example "Your agents' work, anywhere" (27 of 30 characters; the guide's headline "A space for your agents to work." is too long) | Matches `xo-public-language-v1.md`; check the name is free when creating the app record |
| Publisher | Enroll as an **organization**, so the store shows the company as seller | Needs a D-U-N-S number and a public website on the company's own domain |
| Build tools | Update this Mac to macOS Tahoe 26.6 or later and use Xcode 27 | See section 3 |
| Repo | Move `XOSpace/` into its own repo before real work starts | This folder is an experiment inside ClaudeWorkspace |

## 2. Work plan

### Phase A: accounts, tools and legal pages (start now; runs alongside B)
- [ ] Request a free D-U-N-S number from D&B. Allow up to 5 business days for the number, then up to 2 more before Apple sees it.
- [ ] Then enroll in the Apple Developer Program as an organization ($99 a year). The account holder must be able to sign for the company.
- [ ] Accept the latest Apple Developer Program License Agreement (updated 18 Aug 2026).
- [ ] Update macOS to Tahoe 26.6 or later, install Xcode 27, and rebuild the sample. The new system design changes how the tab bar, navigation bars, segmented controls and lists look, so re-check the dark Grove theme.
- [ ] Register the bundle ID `builders.xo.space` and enable Push Notifications and Sign in with Apple on it.
- [ ] Publish a privacy policy at `xo.builders/privacy`. The Terms page in `xo-main` already links to `/privacy`, but no such route exists in the code.
- [ ] Choose the support URL. `xo.builders/contact` exists; it must show real contact details.
- [ ] Declare EU trader status in App Store Connect. This is required even if the app is not sold in the EU. A trader's address, phone and email are verified and shown on EU store pages.
- [ ] Choose the developer name shown under the app. An organization can use a trade name, but it can be set only once, when the first app is created.

### Phase B: make it real (about 3 weeks)
- [ ] **API**: add read endpoints to XO Swarm for the app (spaces, projects with todos, sessions and usage, the Inbox), plus a few writes (mark an Inbox item done, start or stop a space). Reuse the Space's existing payloads so the models in `SampleData.swift` stay the same.
- [ ] **Sign-in**: Clerk iOS SDK plus Sign in with Apple, with the session kept in the Keychain. Apple's private relay emails are moving to `private.icloud.com`, so add that domain to any email allowlist.
- [ ] **Account deletion**: a "Delete account" action in Setup that deletes the XO account and its data, or opens a web page that completes the deletion. Deactivation alone does not count.
- [ ] **Privacy policy inside the app**: a link in Setup. The store listing's URL alone is not enough.
- [ ] **Something a website cannot do** (guideline 4.2):
  - push notifications for "todo blocked", "session finished" and new Inbox items
  - a Home Screen widget with live sessions
  - an offline cache of the last data
- [ ] **AI data consent**: if a feature sends a person's data to a third-party AI (for example, messaging an agent from the phone), disclose it and ask first (guideline 5.1.2(i), added November 2025). Showing sessions and usage does not.
- [ ] **Privacy manifest**: it declares nothing today. `@AppStorage` needs reason CA92.1; data shared with a widget through an App Group needs 1C8F.1. Any analytics or crash SDK on Apple's list must bring its own manifest.
- [ ] **Accessibility**: Dynamic Type, VoiceOver labels (the orbit view already has one), and contrast on the dark theme. Layouts should resize freely, since Apple is asking for that on newer devices.
- [ ] **Age laws**: Texas, Utah and Louisiana now have app store age-verification laws, and Apple asks apps to adopt the Declared Age Range API. Ask a lawyer whether a B2B companion app needs it.

### Phase C: TestFlight (about 1 week)
- [ ] Archive and upload builds from Xcode, or use Xcode Cloud or fastlane so it repeats cleanly. Bump the build number on every upload.
- [ ] Internal testing with up to 100 team members, with no review.
- [ ] Then an external group (up to 10,000 testers). The first build needs a beta review and a beta description. Builds expire after 90 days.

### Phase D: store listing and submission (about 1 week)
- [ ] **Screenshots** (1 to 10 per size, PNG or JPEG, no alpha):
  - iPhone 6.9-inch at 1320x2868. Capture from the iPhone 16 Pro Max simulator.
  - iPad 13-inch at 2064x2752. Capture from the iPad Pro 13-inch (M4) simulator. Required because the app runs on iPad.
- [ ] **Listing text**: description, keywords, promotional text, copyright, and category (Developer Tools, with Productivity as secondary).
- [ ] **App Privacy answers**:
  - account details (email, name, user ID) linked to the user
  - no tracking
  - usage or diagnostics only if collected
  - include what any SDK collects
- [ ] **Age rating questionnaire**: the 2025 version with 13+, 16+ and 18+ ratings. Answers are required for new apps now.
- [ ] **App Review information**:
  - what XO is and where to look (Projects, then a live project)
  - a demo login that never expires, backed by a hosted demo space with the sample projects. A demo mode in place of a login needs Apple's approval in advance.
  - a contact phone in international format
- [ ] Submit. Answer review questions the same day, then release manually or in phases.

## 3. Store requirements that apply

Checked on 25 September 2026, mostly on developer.apple.com. Recheck them at submission time.

| Area | Requirement | Source |
|---|---|---|
| Build tools | Since 28 Apr 2026, uploads must be built with Xcode 26 or later and the iOS 26 SDK. App Store Connect has accepted Xcode 27 builds since 14 Sep 2026. From April 2027, the iOS 27 SDK and a minimum target of iOS 15 are required. | developer.apple.com/news/upcoming-requirements |
| This Mac | macOS 15.4.1 with Xcode 16.4, so it cannot upload today. The minimum fix is macOS 15.6 with Xcode 26.3 (the last release that runs on Sequoia). The lasting fix is macOS Tahoe 26.6 with Xcode 27. | developer.apple.com/xcode/system-requirements |
| New design | The latest SDK gives standard controls the new design. The `UIDesignRequiresCompatibility` opt-out is ignored for iOS 27 SDK builds. | Apple documentation for `UIDesignRequiresCompatibility` |
| Developer Program | $99 a year. An organization needs a legal entity, a D-U-N-S number and a website on its own domain; its legal name is shown as the seller. | developer.apple.com/programs/enroll |
| Screenshots | iPhone 6.9-inch (1320x2868, 1290x2796 or 1260x2736). iPad 13-inch (2064x2752 or 2048x2732) if the app runs on iPad. | App Store Connect Help: screenshot specifications (modified 17 Sep 2026) |
| Privacy | App Privacy answers, a privacy policy URL, and a privacy policy link inside the app. The support URL must reach real contact information. | App Store Connect Help; guideline 5.1.1(i) |
| Privacy manifest | Required-reason APIs (UserDefaults, file timestamps, system boot time, disk space, active keyboards) need a declared reason, or the upload is rejected. | Apple documentation: required reason APIs |
| Age rating | The 13+, 16+ and 18+ questionnaire must be answered for new apps and updates. | Apple Developer News, Jul 2025 and Jul 2026 |
| EU | Trader status must be declared. Apps without one are removed from the EU store. | App Store Connect Help: Digital Services Act |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO` (already set) skips the questionnaire when the app only uses the system's HTTPS. | Apple documentation: encryption export regulations |
| Review | Most submissions are reviewed within 24 to 48 hours; waits of 3 to 5 days were reported in early 2026. Plan for 2 to 3 days per round and one rejection. | developer.apple.com/distribute/app-review |

## 4. Likely rejection reasons and how the plan covers them

| Risk | Guideline | Covered by |
|---|---|---|
| Upload built with an old Xcode | Upload requirement | Tools update in Phase A |
| Reviewer cannot sign in, the login has expired, or the app is empty | 2.1 | A non-expiring demo login backed by a populated hosted demo space |
| Looks like a website in a wrapper | 4.2 | Native UI already; push notifications, widget and offline cache in Phase B |
| Social sign-in without an equivalent private option | 4.8 | Sign in with Apple |
| No way to delete an account from inside the app | 5.1.1(v) | Delete account in Setup |
| Privacy policy missing from the app | 5.1.1(i) | Link in Setup |
| Plan prices, upgrade buttons or purchase links | 3.1.1, 3.1.3 | No purchasing or pricing in v1 |
| Sample content presented as real | 2.1, 2.3 | Sample data only in the review demo space, clearly labelled |
| Data sent to an AI service without consent | 5.1.2(i) | Disclosure and consent before any such feature |

## 5. Timeline

About 6 weeks from the go decision:
- week 1: accounts, D-U-N-S and the tools update
- weeks 1 to 4: the API, sign-in and native features
- week 5: TestFlight
- week 6: listing, review and release

The D-U-N-S number and the macOS and Xcode update are the first blockers, so start them today.
