# Face Recognition Migration — face-api → Human

Plan for migrating face verification from `@vladmandic/face-api` (FaceNet)
to `@vladmandic/human` (MobileFaceNet + liveness/antispoof).

**Goal**: better accuracy on Asian faces, kill the "use someone else's photo"
loophole, and stop look-alikes (siblings, similar features) from passing
verification — without blocking anyone at clock-in time during the switch.

## Why migrate

| Pain point reported | Root cause | Fix path |
|---|---|---|
| Look-alikes verify successfully | FaceNet 128-d descriptor + 0.55 threshold | MobileFaceNet 1024-d + lower threshold |
| Some employees "hard to scan" | TinyFaceDetector bias on darker skin | Human's MeshFaceDetector + larger input |
| Photo of employee bypasses scan | No liveness check at all | Built-in liveness + anti-spoof scores |

Phase 1 (already shipped) tunes the existing face-api stack to relieve the
worst of these. It buys time but doesn't close the photo-attack hole.

## Why not just retrain face-api

The two libraries produce **incompatible embeddings** — both output float
vectors but the dimensions encode entirely different features. There's no
mathematical conversion; existing descriptors must be re-captured against
the new model.

```
Same face → face-api  → [0.12, -0.45, 0.78, ...] (128-d)
         → Human     → [0.89, 0.34, -0.21, ...] (1024-d)   ← incomparable
```

## Soft migration strategy

Run both stacks in parallel for ~4 weeks, then deprecate v1.

### Schema (already created)

```sql
-- database/20260515_face_descriptor_v2.sql
ALTER TABLE employees
  ADD COLUMN face_descriptor_v2 LONGTEXT NULL,
  ADD COLUMN face_descriptor_migrated_at TIMESTAMP NULL;
```

### Verify-time logic

```
on clock-in scan:
  if employee.face_descriptor_v2 is set:
    use Human → verify against v2 (strict + liveness)
  else if employee.face_descriptor is set:
    use face-api → verify against v1 (legacy path)
    on success: show "Upgrade scan" prompt → /face/upgrade
  else:
    block with "register face first"
```

### Upgrade flow

A new screen `/face/upgrade` (similar to existing `/admin/face-registration`
but driven by Human library):

1. Walk user through 3-angle capture (left / center / right) like today
2. Run liveness + anti-spoof on every frame; reject if either drops < 0.5
3. POST descriptors → backend averages → write to `face_descriptor_v2` +
   set `face_descriptor_migrated_at`
4. Optionally clear `face_descriptor` after a 30-day grace period

### Communication plan

| Day | Action |
|----|--------|
| 0 | Deploy v2 schema + Human stack as opt-in (banner: "อัปเกรดสแกนหน้าเร็วขึ้น 30 วินาที") |
| 7 | Push notification reminder to non-migrated staff |
| 14 | Banner becomes "harder to dismiss" (modal once per session) |
| 21 | HR contacts the remaining holdouts directly |
| 28 | Clock-in requires v2; legacy column dropped in next migration |

## Implementation checklist

### Backend

- [x] DB migration — `database/20260515_face_descriptor_v2.sql`
- [ ] `api/face.php`:
  - [ ] Accept `descriptor_v2` (single) or `descriptors_v2` (array, averaged)
        on POST and write to `face_descriptor_v2` + set migrated_at
  - [ ] GET response includes `has_face_v2`, `descriptor_v2`, `migrated_at`
  - [ ] Validate v2 length (1024) matches Human's output
- [ ] No changes needed to legacy descriptor handling — keep it until day 28

### Frontend

- [x] Phase 1: tune face-api thresholds — `components/FaceCapture.tsx`
- [x] Phase 2: POC — `screens/admin/AdminFaceTestScreen.tsx` at `/admin/face-test`
- [ ] Mirror Human models to `public/models-v2/` (currently CDN for POC)
- [ ] Build `components/HumanFaceCapture.tsx` — same API shape as
      `FaceCapture` so `HomeScreen` can switch implementations per-employee
- [ ] Update `HomeScreen` clock-in flow to check `face_descriptor_v2`
      first and prompt upgrade after legacy verify
- [ ] Add `/face/upgrade` route + screen for the 3-angle re-registration

### Operations

- [ ] Monitor `face_descriptor_migrated_at IS NULL` count per company
      (add a card to the admin dashboard)
- [ ] Rollback plan: if Human verify fails at higher rate than expected,
      flip a feature flag to keep using legacy until issue is fixed
- [ ] Day-28 migration to drop `face_descriptor` column once 100% migrated

## Open questions

1. **Self-host Human models or stay on CDN?**
   - CDN saves ~12 MB in build output but adds external dependency.
   - Recommendation: mirror to `public/models-v2/` before the production
     rollout; CDN is fine only for POC.

2. **Average descriptors vs store all 3 separately?**
   - Current face.php averages on the backend (line 37-50 of api/face.php).
   - Storing 3 separately and matching against the closest one improves
     precision noticeably — recommend doing this when wiring up v2.

3. **Should re-registration require admin approval?**
   - Tradeoff: friction vs preventing rogue re-registration if a
     session token is compromised. Recommend: no admin approval (matches
     current behavior), but log every v2 registration in `security_alerts`.
