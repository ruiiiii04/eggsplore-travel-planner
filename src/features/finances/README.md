# Module D: Money & Logistics (planned)

Implement budget screens, expense splits, explicit mock pricing, booking links
and notifications here. The existing expenses table is owner-managed and has no
split/authorship model. Add appropriate tables, constraints and RLS before
allowing member-authored expenses. Use integer minor units or decimal-safe math.

C owns maps; consume its coordinates, travel time and transport mode for cost
estimates. Coordinate disruption event delivery with C. The saved profile
notification boolean is only a preference: permissions, push tokens, scheduling,
delivery and notification history are not implemented.
