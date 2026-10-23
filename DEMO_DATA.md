# Safe demo data and two-student workflow

The demo seeder creates fictional student profiles using the existing `User` and `Skill` models and the existing skill catalogue. It does not create reviews, exchange requests, sessions, conversations, messages, ratings, or activity metrics. Profiles without a valid completed-session review appear as new, with no rating.

The User schema has no year-of-study field, so the demo profiles do not invent one. Their profile photos use the app's existing initials fallback rather than external images. Demo email addresses use the reserved `.invalid` domain.

## Seed a development database

The seeder reads `MONGODB_URI` from the shell or `server/.env` and uses the app's existing `skillswap` database. It refuses `NODE_ENV=production`, requires an explicit mode and confirmation, skips any existing reserved demo email without changing it, and stores only a bcrypt password hash. By default, it accepts only a local MongoDB host.

In PowerShell, configure the private development environment and run:

```powershell
$env:NODE_ENV = 'development'
$env:DEMO_SEED_CONFIRM = 'CREATE_DEMO_DATA'
$securePassword = Read-Host 'Enter a private password for the demo accounts (8-72 UTF-8 bytes)' -AsSecureString
$env:DEMO_SEED_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
npm run seed:demo --workspace server -- --apply
```

For a remote MongoDB development cluster, first verify that `MONGODB_URI` points to a dedicated development database, then explicitly opt in:

```powershell
$env:DEMO_SEED_ALLOW_REMOTE = 'true'
```

Never set this opt-in for production or point the seeder at production. The command does not print the URI or password.

## Reset seeder-owned demo data

Reset removes only accounts carrying the private `demoSeedKey` marker created by this script, along with their linked requests, sessions, conversations, messages, and reviews. Existing accounts that merely share a reserved email are skipped during seeding and are not reset.

```powershell
$env:NODE_ENV = 'development'
$env:DEMO_SEED_CONFIRM = 'RESET_DEMO_DATA'
npm run seed:demo --workspace server -- --reset
```

Reset intentionally removes workflow data connected to seeded demo accounts, including requests initiated by another account to a demo profile. The skill catalogue and unrelated users and records are retained. The password is not required for reset.

To remove the seeder confirmations after use:

```powershell
Remove-Item Env:DEMO_SEED_CONFIRM -ErrorAction SilentlyContinue
Remove-Item Env:DEMO_SEED_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:DEMO_SEED_ALLOW_REMOTE -ErrorAction SilentlyContinue
```

Also clear the local PowerShell variables when finished:

```powershell
$env:DEMO_SEED_PASSWORD = $null
Remove-Variable securePassword -ErrorAction SilentlyContinue
```

## Fictional profiles

All proficiencies are from the app's supported `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, and `EXPERT` values. Matches and scores are calculated by the normal matching service.

| Student | Can teach | Wants to learn |
|---|---|---|
| Aarav Mehta | Python (Intermediate), JavaScript (Beginner) | React (Beginner), UI/UX Design (Beginner) |
| Ananya Sharma | React (Advanced), HTML (Intermediate), CSS (Intermediate) | Python (Beginner), Guitar (Beginner) |
| Kabir Verma | Python (Advanced), Spanish (Intermediate) | React (Intermediate), Figma (Beginner) |
| Mira Iyer | Figma (Advanced), UI/UX Design (Intermediate) | HTML (Beginner), Photography (Beginner) |
| Noah Williams | HTML (Advanced), CSS (Advanced) | JavaScript (Intermediate), Piano (Beginner) |
| Sara Haddad | Photography (Advanced), Video Editing (Intermediate) | Figma (Beginner), Spanish (Intermediate) |
| Dev Patel | Guitar (Expert), Piano (Intermediate) | Video Editing (Beginner), Public Speaking (Beginner) |
| Isha Okafor | Spanish (Advanced), Public Speaking (Intermediate) | Guitar (Beginner), Academic Writing (Intermediate) |
| Rohan Das | Academic Writing (Advanced), JavaScript (Intermediate) | Spanish (Beginner), CSS (Intermediate) |
| Leila Haddad | French (Expert), Graphic Design (Intermediate) | Photography (Beginner), UI/UX Design (Intermediate) |
| Marcus Chen | Video Editing (Advanced), Piano (Beginner) | Photography (Intermediate), JavaScript (Beginner) |
| Zoya Khan | Public Speaking (Advanced), UI/UX Design (Intermediate) | React (Beginner), French (Beginner) |
| Arjun Rao | CSS (Advanced), Python (Intermediate) | Graphic Design (Beginner), Guitar (Beginner) |
| Nina Petrova | React (Intermediate), French (Beginner) | Python (Beginner), Academic Writing (Intermediate) |

## Demonstrate the real exchange workflow

Use two separate browser profiles (not two tabs or incognito windows sharing one cookie jar). Sign both in with the private demo password supplied to the seeder:

- Student A: `demo.aarav.mehta@profiles.skillswap.invalid`
- Student B: `demo.ananya.sharma@profiles.skillswap.invalid`

1. In Student A's browser, open Discover, find Ananya, inspect her profile, and send a request for React. Optionally offer Python.
2. In Student B's browser, open Received requests and accept the request.
3. Either participant can propose a session from the accepted exchange. Choose a future time and a duration between 15 minutes and 4 hours.
4. Confirm the proposal in the other browser. Open Messages in both browsers and exchange messages; verify the unread indicator from the other account.
5. Wait until the scheduled end time, then complete the confirmed session. The API correctly refuses early completion.
6. Submit a review from Reviews after completion. Verify the new, real rating on Student A's Discover card and profile.

The usual manual process includes waiting for the session's scheduled end because completion is intentionally restricted until then. Do not alter database status directly to speed up a product demonstration.

## Checks

```powershell
npm test --workspace server
npm run lint
npm run build
```

The tests cover seed fixture repeatability and safety gates, actual matching-score variety, and verified minimum-rating filtering before pagination. A MongoDB connection is required to execute `--apply` or `--reset`; those commands are deliberately not run as part of the test suite.
