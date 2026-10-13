# Eggsplore

**Plan together. Explore with AI.** Eggsplore helps travel groups collect ideas, decide together, plan a trip, explore places, and manage shared costs in one app.

**Team:** Purple Feelings — Yii Aik Lui, Anson Wong Leon Sheng, Lee Zhi Wei, Tan Zhi Shing

**GitHub:** [ruiiiii04/eggsplore-travel-planner](https://github.com/ruiiiii04/eggsplore-travel-planner)

## Try Eggsplore

- **Android download:** Add the public APK/download link before submission.
- **Create an account:** On the login screen, tap **New to Eggsplore? Create account**. Enter a valid email and a password of at least 8 characters (confirm it when prompted), then tap **Create Account**. If email confirmation is enabled, confirm through your inbox, return to Eggsplore, and log in manually.
- Eggsplore requires an internet connection and a working app backend. A prepared trip is recommended for the fastest judging walkthrough.

## Judge guide

Sign in and explore the four bottom tabs: **Home · Trip · Map · Profile**. Create a trip or open an existing trip to try the full workflow.

### Home — create or find a trip

- Browse trip cards and filter by **Live**, **Upcoming**, or **Past**. Tap a card to open its trip workspace.
- **Create Trip** collects destination, dates, travel style, preferences, budget range, and invitees.
- Add both start and end dates to generate an initial AI itinerary (up to 14 days). Leave both blank to create a flexible trip; no initial itinerary is generated, but you can start with candidate places and vote first.
- Quick access shortcuts open expense entry, pending votes, emergency info, and member invitations.

### Trip — plan, vote, and manage costs

Open a trip, then use **Itinerary**, **Vote**, and **Budget**.

- **Itinerary:** The initial AI draft uses destination, dates, trip type, budget, and trip preferences. Review and edit it; add or reorder stops. AI suggestions are drafts, so verify hours, routes, and prices yourself.
- **Vote:** Add a candidate manually, from a photo, or from a link; **Get more AI Ideas** can suggest places for the destination. Photo/link import tries to identify the place and fill in its name, location, and tags—review these fields before submitting. AI ideas are unverified and do not enter the itinerary automatically. Link import uses information available from the URL; it does not scrape Instagram/TikTok or resolve every shortened link.
- Vote **👍 / 👎** on candidates. Saved preference profiles and candidate tags contribute to preference-weighted vote scores; available group preferences also inform AI place suggestions.
- **In Draft** means a candidate is selected for the proposed plan, not simply that someone voted for it. Open **Review Draft** to see selected places ranked by votes, assign/edit days and times, and reorder or remove stops. The Group Leader can confirm and publish the editable draft to the itinerary. This vote-ranked draft is separate from the AI itinerary generated during trip creation.
- **Budget:** Set your personal trip budget, then add expenses. The cost estimate is a rough per-person range based on destination cost profiles and trip length; unsupported destinations may use an AI estimate, falling back to a default range if unavailable. It excludes flights and is not a live quote. Split an expense evenly, enter custom shares, or keep it with the payer; review balances and mark splits settled.
- **My Notes** stores private trip notes and reminders. **Trip options** lets the Group Leader invite/manage members and open **Flight details**.

### Trip Recovery — try the disruption demo

In **Trip options → Flight details**, save a flight. For a reliable walkthrough, a Group Leader can choose **Demo: simulate a 3-hour delay**. Return to the itinerary and tap **Review Impact** on the disruption card; review, edit/reorder affected activities, then publish the recovery plan. Live flight checks need the flight-status service configured; automatic background monitoring needs a working scheduler. The demo control avoids waiting for a real delay.

### Map — explore and add places

- Choose **My Trip** to see itinerary places or **Explore** to find places around the selected destination. Use the Vibe/category filters to narrow results.
- Tap a place to view its details and available photos, then use **Ask AI** for place-specific questions. In **Explore**, choose **Add to Itinerary** to pass the selected place into the trip plan; only the Group Leader can add or edit itinerary activities.
- The Map weather tile is sample data; live weather alerts are not connected.

### Profile — personalize the planning

- Edit account details or change your password.
- Create a travel preference profile with a travel style, interests, pace, companions, and spending priorities. Saved profiles inform candidate suggestions and preference-weighted voting. The separate preferences selected in Create Trip inform the initial AI itinerary.
- Save emergency contacts and destination information. Set preferred units and notification preferences; push delivery depends on the demo environment.

## Project details

See the [project proposal](docs/PROJECT-PROPOSAL.md) for the problem and solution overview. See [setup and phone testing](docs/START-HERE.md) for development setup.
