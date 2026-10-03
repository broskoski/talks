# talks

Drives a live talk where the audience shouts out which Are.na channels get assembled into it.
All state lives on Are.na: a talk is a private channel in the group with `talk: true` metadata,
and building the talk fills that channel with every block from the picked topic channels.

## Setup

1. Put a **write-scope** Are.na token, the group slug, and a password in `.env.local`:

   ```
   ARENA_TOKEN=...
   ARENA_GROUP=talks-c6grc3a6lhq
   ADMIN_PASSWORD=...
   ```

2. `npm install && npm run dev`, then open http://localhost:3000 and log in.

## Pages

- `/` — talks list and new-talk form
- `/topics` — every non-talk channel in the group, with editable minutes (estimated from block count until set)
- `/talks/[id]` — name, length in minutes, status, rounds editor, picks, delete
- `/talks/[id]/stage` — the stage screen: keys 1/2/3 pick, Backspace undoes, then Build

## Metadata on Are.na

Talk channel: `talk: true`, `minutes` (talk length), `rounds` (JSON array of arrays of channel ids; a one-id round is fixed and skips the vote),
`picks` (JSON array of channel ids), `status` (`draft` | `live` | `built`), `built_at`.
Topic channel: `minutes` (presenting time; when missing, estimated as 20 seconds a block, at least 1).
