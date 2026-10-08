# Running on a phone

The Expo CLI warning means the phone cannot reach the development server; it is separate from application layout and Supabase migrations.

Stop the old Expo process with Ctrl+C. Run npm run start:phone (equivalent to npm start -- --go --tunnel --clear), keep the terminal running, reopen Expo Go, and scan the new QR code. Expo may ask to install its tunnel dependency on first use. Both the computer and phone need internet access. For LAN mode use npm start -- --go --clear and connect the phone and computer to the same Wi-Fi network.

Candidate Add/Review full-screen modals have their own safe-area provider. Their scroll region explicitly takes only the space remaining above a nonshrinking footer. Creation wizard screens use the same bounded scrolling and a keyboard-avoiding container, with headers and action footers protected from shrinking. The trip-created screen now scrolls on small displays so its actions remain reachable.

Check on Android with gesture navigation and with three-button navigation: Add a Candidate -> Submit for Voting; Review Draft -> Confirm & Publish Plan; Create Trip -> Details/Preferences -> Next. Repeat with the keyboard open and after dismissing it. Web and larger text should also remain usable.

No SQL migration is needed for these UI changes. A physical phone is not connected to this workspace, so device verification is still needed.
