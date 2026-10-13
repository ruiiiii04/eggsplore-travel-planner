# Eggsplore

**Plan together. Explore with AI.** Eggsplore helps travel groups collect ideas, decide together, plan a trip, explore places, and manage shared costs in one app.

**Team:** Purple Feelings — Yii Aik Lui, Anson Wong Leon Sheng, Lee Zhi Wei, Tan Zhi Shing

**GitHub:** [ruiiiii04/eggsplore-travel-planner](https://github.com/ruiiiii04/eggsplore-travel-planner)

## Try Eggsplore

- **Android APK (v1.0.0):** [Download Eggsplore for Android](https://expo.dev/artifacts/eas/h57DGOCGbr0zDvuLAypJ3IQdI-s3Q34D37Ligd59shQ.apk). This EAS preview link expires on **27 October 2026**; publish the APK as a public GitHub Release asset before then for a durable judging link.
- **Create an account:** On the login screen, tap **New to Eggsplore? Create account**. Enter a valid email and a password of at least 8 characters (confirm it when prompted), then tap **Create Account**. If email confirmation is enabled, confirm through your inbox, return to Eggsplore, and log in manually.
- Eggsplore requires an internet connection and a working app backend. A prepared trip is recommended for the fastest judging walkthrough.

## Judge guide

Sign in and explore the four bottom tabs: **Home · Trip · Map · Profile**. Create a trip or open an existing trip to try the full workflow.

### Home — create or find a trip

- Browse trip cards and filter by **All**, **Live**, **Upcoming**, or **Past**. Tap a card to open its trip workspace.
- **Create Trip** collects trip type, destination, dates, travel style, preferences, budget range, and invitees.
- Add both start and end dates to generate an initial AI itinerary (up to 14 days). Leave both blank to create a flexible trip; no initial itinerary is generated, but you can start with candidate places and vote first.
- Quick access shortcuts open expense entry, pending votes, emergency info, and member invitations.

### Trip — plan, vote, and manage costs

Open a trip, then use **Itinerary**, **Vote**, and **Budget**. The drop-down at the top switches between your trips.

- **Itinerary:** The initial AI draft uses destination, dates, trip type, budget, and trip preferences. Review and edit it; add or edit activities, reorder stops, and add or delete whole days. Choosing a location from the search list (Geoapify) gives the activity a map pin; you can also save an activity without a pin and find its location later on the Map. Only the Group Leader can add or edit itinerary activities. AI suggestions are drafts, so verify hours, routes, and prices yourself.
- **Vote:** Add a candidate manually, from a photo, or from a link; **Get more AI Ideas** can suggest places for the destination. Photo/link import tries to identify the place and fill in its name, location, and tags—review these fields before submitting. AI ideas are unverified and do not enter the itinerary automatically. Link import uses information available from the URL; it does not scrape Instagram/TikTok or resolve every shortened link.
- Vote **👍 / 👎** on candidates. Saved preference profiles and candidate tags contribute to preference-weighted vote scores; available group preferences also inform AI place suggestions.
- **In Draft** means a candidate is selected for the proposed plan, not simply that someone voted for it. Open **Review Draft** to see selected places ranked by votes, assign/edit days and times, and reorder or remove stops. The Group Leader can confirm and publish the editable draft to the itinerary. This vote-ranked draft is separate from the AI itinerary generated during trip creation.
- **Budget:** Set your personal trip budget, then add expenses. The tab shows your budget with a progress bar, an estimated trip cost, **Quick Add by Category** shortcuts, and your recent expenses.
  - Expenses can be entered in 40+ currencies; amounts are shown in RM, using fixed estimated rates rather than live rates.
  - Split an expense evenly, enter exact amounts, or choose Don't Split to keep it with the payer. On a solo trip the split controls are hidden.
  - The **You owe** row lists what you owe each person. **Mark as paid** settles it as a record only (no money moves) and cannot be undone.
  - The cost estimate is a rough per-person range based on destination cost profiles and trip length; unsupported destinations may use an AI estimate, falling back to a default range if unavailable. It excludes flights and is not a live quote.
- **My Notes** stores private trip notes and reminders.
- **Trip details** has a **Trip members** card, where the Group Leader can invite members by Eggsplore username and manage them, and a **Flight details** card below it.

### Trip Recovery — try the disruption demo

Open **Trip details → Flight details**. Add your **outbound** flight and, optionally, your return flight, and save each separately. The Group Leader can tap **Check now**, or turn on monitoring near departure, and can enable sharing so trip members see disruptions.

For a reliable walkthrough, a Group Leader can choose **Demo: simulate a 3-hour delay**. Return to the itinerary and tap **Review Impact** on the disruption card. For an outbound delay, the app suggests later activity times; activities that would move past midnight are marked **Needs manual review**. The Group Leader can edit times, reorder activities, or tap **Regenerate suggested schedule** to reset manual adjustments. Tap **Confirm & Publish Plan** to update the shared itinerary; until then, the current itinerary stays unchanged.

For cancellations or return-flight disruptions, review replacement flights or airport transfers manually; the app does not automatically shift activities. Live flight checks need the flight-status service configured; automatic background monitoring needs a working scheduler. The demo control avoids waiting for a real delay.

### Map — explore and add places

- Choose a trip at the top, then choose **My Trip** to see itinerary places or **Explore** to find up to 20 places around the selected destination that are not in the plan yet.
- Use the **Vibe layers** to narrow results by category, such as Attractions, Foodie, Heritage, Nature, Shopping, and Stay. A place can belong to more than one layer; places whose vibe is unclear appear under Unclassified.
- Tap a pin to open the place's details panel: an image, a category tag, and a short description from Wikipedia where available. Opening hours, ratings, and walking directions are not available yet.
- Use **Ask AI** for place-specific questions. The chat starts with suggested questions, and follow-up buttons appear after each answer. Ask AI has a limit on questions per minute and per day.
- In **My Trip**, **View itinerary** opens the Trip page. If a place has no map pin, tap **View places without pins**, then **Find location** to open the activity editor and confirm the right address from a list of matches (many places share similar names).
- In **Explore**, choose **Add to Itinerary** to pass the selected place into the activity editor; only the Group Leader can add or edit itinerary activities. After saving, the place appears in the itinerary and in My Trip.
- The Map weather tile is sample data; live weather alerts are not connected.

### Profile — personalize the planning

- Edit account details or change your password.
- Create a travel preference profile with a name, an icon, a travel style, interests, category weights (such as culture, nature, food, and adventure), pace, companions, and spending priorities. Saved profiles inform candidate suggestions and preference-weighted voting; higher weights give matching places more influence in your votes. The separate preferences selected in Create Trip inform the initial AI itinerary.
- Save emergency contacts (name, phone number, relationship) and destination information such as the embassy and local emergency numbers. Set preferred units and notification preferences; push delivery depends on the demo environment.

### Notifications
- Tap the bell to open the in-app notification list. A red dot means unread items; tap an item to jump to the right place, or tap Mark all as read.
- Alerts cover new expenses that include you, payments marked as paid, note reminders, and likely rain (60% or more) on outdoor itinerary activities in the next 48 hours.
- Notifications appear inside the app. Phone push notifications are not fully available; push delivery depends on the demo environment.

### Known limits
- Exchange rates and price estimates are fixed guides, not live prices, and estimates exclude flights.
- Expenses cannot be edited or deleted yet, and **Mark as paid** cannot be undone.
- AI suggestions, ideas, and answers can be wrong; verify hours, routes, and prices yourself.

## Project details

See the [project proposal](docs/PROJECT-PROPOSAL.md) for the problem and solution overview. See [setup and phone testing](docs/START-HERE.md) for development setup.
