1 # Habit Tracker Module (Amigo)

## Overview

The **Habit Tracker** module implements a two-person accountability system where friends stake USDC on weekly habits. Participants check in throughout the week, and the one who meets their goal wins the weekly payout. If both succeed or both fail, they split the payout 50/50.

**Contract Status**: ✅ Ready for deployment  
**Module Name**: `habit_tracker`  
**Tests**: 33/33 passing  

---

## Core Concept

Two friends commit to a habit (e.g., "Go to the gym 3 times this week") and stake money on it:
- Each person deposits half of the weekly payout × number of weeks
- Throughout the week, they check in when they complete the habit
- At the end of the week, the winner is determined based on who met their check-in requirement
- Winner gets the full weekly payout (or 50/50 if both succeed/fail)

---

## Architecture

### Commitment Structure

Each commitment contains:
- **Participants**: Two addresses (participant_a and participant_b)
- **Weekly Payout**: Amount winner receives each week (in USDC)
- **Duration**: Number of weeks the commitment lasts
- **Check-in Requirement**: Number of check-ins needed per week to succeed
- **Start Time**: When the commitment begins (timestamp)
- **Check-in History**: All check-ins recorded by week and participant
- **Week Processing**: Track which weeks have been settled

### Payout Logic

Each week, payouts are determined as follows:

```
IF participant_a meets requirement AND participant_b does not:
    → participant_a wins full weekly payout

ELSE IF participant_b meets requirement AND participant_a does not:
    → participant_b wins full weekly payout

ELSE (both succeed OR both fail):
    → Split 50/50
```

### Fee Structure

- **Deposit Fee**: 0.3% on initial deposits from both participants
- **No fee on payouts**: Winners receive full amounts

---

## Entry Functions

### 1. Create Commitment

```move
public entry fun create_commitment(
    account: &signer,
    group_id: u64,
    participant_b: address,
    weekly_payout: u64,
    weekly_check_ins_required: u64,
    duration_weeks: u64,
    commitment_name: String,
)
```

**Description**: Create a new habit commitment and invite another group member.

**Requirements**:
- Both participants must be members of the specified group
- `duration_weeks` must be > 0
- `weekly_check_ins_required` must be > 0
- Deposits `(weekly_payout * duration_weeks / 2) + 0.3% fee` in USDC

**Example**:
```typescript
// Alice creates a 4-week gym commitment with Bob
// Weekly payout: 10 USDC, Need 3 check-ins per week
const payload = {
  function: `${CONTRACT_ADDRESS}::habit_tracker::create_commitment`,
  arguments: [
    0,                          // group_id
    "0xBOB_ADDRESS",           // participant_b
    10_000_000,                // weekly_payout (10 USDC in 6 decimals)
    3,                         // weekly_check_ins_required
    4,                         // duration_weeks
    "Morning Gym Commitment"   // commitment_name
  ]
};
// Alice deposits: (10 USDC * 4 weeks / 2) + 0.3% = 20.06 USDC
```

---

### 2. Accept Commitment

```move
public entry fun accept_commitment(
    account: &signer,
    group_id: u64,
    commitment_local_id: u64,
)
```

**Description**: Accept a commitment invitation and deposit your stake.

**Requirements**:
- Must be the invited participant (participant_b)
- Commitment must not already be accepted
- Commitment must be valid (not deleted)
- Deposits `(weekly_payout * duration_weeks / 2) + 0.3% fee` in USDC

**Example**:
```typescript
// Bob accepts Alice's commitment
const payload = {
  function: `${CONTRACT_ADDRESS}::habit_tracker::accept_commitment`,
  arguments: [
    0,  // group_id
    0   // commitment_local_id
  ]
};
// Bob deposits: 20.06 USDC (same as Alice)
```

---

### 3. Delete Commitment

```move
public entry fun delete_commitment(
    account: &signer,
    group_id: u64,
    commitment_local_id: u64,
)
```

**Description**: Cancel a commitment before it's accepted and get a refund.

**Requirements**:
- Must be the creator (participant_a)
- Commitment must not be accepted yet
- Commitment must be valid

**Example**:
```typescript
// Alice cancels the commitment before Bob accepts
const payload = {
  function: `${CONTRACT_ADDRESS}::habit_tracker::delete_commitment`,
  arguments: [
    0,  // group_id
    0   // commitment_local_id
  ]
};
// Alice gets her 20 USDC refunded (fees not refunded)
```

---

### 4. Check In

```move
public entry fun check_in(
    account: &signer,
    group_id: u64,
    commitment_local_id: u64,
)
```

**Description**: Record a check-in for the current week.

**Requirements**:
- Must be a participant in the commitment
- Commitment must be accepted
- Must be within the commitment duration
- Cannot exceed weekly check-in limit

**Example**:
```typescript
// Alice checks in after going to the gym
const payload = {
  function: `${CONTRACT_ADDRESS}::habit_tracker::check_in`,
  arguments: [
    0,  // group_id
    0   // commitment_local_id
  ]
};
// Alice's check-in count for current week increases by 1
```

---

### 5. Process Week

```move
public entry fun process_week(
    account: &signer,
    group_id: u64,
    commitment_local_id: u64,
    week: u64,
)
```

**Description**: Process results for a completed week and distribute payouts.

**Requirements**:
- Week must have ended (current_time >= week_end_time)
- Week must not have been processed yet
- Week number must be valid (< duration_weeks)

**Example**:
```typescript
// Anyone can process week 0 after it ends
const payload = {
  function: `${CONTRACT_ADDRESS}::habit_tracker::process_week`,
  arguments: [
    0,  // group_id
    0,  // commitment_local_id
    0   // week (0-indexed)
  ]
};
// Payouts distributed based on check-in success
```

---

## View Functions

### Get Commitment Details

```move
#[view]
public fun get_commitment_details(group_id: u64, commitment_local_id: u64): (
    address,  // participant_a
    address,  // participant_b
    u64,      // weekly_payout
    u64,      // duration_weeks
    bool,     // accepted
    bool,     // valid
    String,   // commitment_name
    u64,      // start_time
    u64       // weekly_check_ins_required
)
```

**Example**:
```typescript
const [pa, pb, payout, duration, accepted, valid, name, startTime, requiredCheckins] = 
  await client.view({
    function: `${CONTRACT_ADDRESS}::habit_tracker::get_commitment_details`,
    arguments: [0, 0],  // group_id, commitment_local_id
    type_arguments: []
  });

console.log(`${name}: ${pa} vs ${pb}`);
console.log(`Weekly payout: ${payout} USDC, ${duration} weeks`);
console.log(`Need ${requiredCheckins} check-ins per week`);
```

---

### Get Weekly Check-Ins

```move
#[view]
public fun get_weekly_check_ins(
    group_id: u64,
    commitment_local_id: u64,
    week: u64,
    participant: address
): u64
```

**Example**:
```typescript
const checkIns = await client.view({
  function: `${CONTRACT_ADDRESS}::habit_tracker::get_weekly_check_ins`,
  arguments: [0, 0, 0, aliceAddress],  // group, commitment, week, participant
  type_arguments: []
});

console.log(`Alice has ${checkIns} check-ins this week`);
```

---

### Is Week Processed

```move
#[view]
public fun is_week_processed(
    group_id: u64,
    commitment_local_id: u64,
    week: u64
): bool
```

---

### Get User Commitments

```move
#[view]
public fun get_user_commitments(group_id: u64, user: address): vector<u64>
```

**Example**:
```typescript
const commitmentIds = await client.view({
  function: `${CONTRACT_ADDRESS}::habit_tracker::get_user_commitments`,
  arguments: [0, aliceAddress],
  type_arguments: []
});

console.log(`Alice has ${commitmentIds.length} commitments in this group`);
```

---

### Get Current Week

```move
#[view]
public fun get_current_week(group_id: u64, commitment_local_id: u64): u64
```

---

### Is Commitment Ended

```move
#[view]
public fun is_commitment_ended(group_id: u64, commitment_local_id: u64): bool
```

---

### Get All Check-Ins

```move
#[view]
public fun get_all_check_ins(
    group_id: u64,
    commitment_local_id: u64
): (vector<u64>, vector<address>, vector<u64>)
// Returns: (weeks, participants, check_in_counts)
```

**Example**:
```typescript
const [weeks, participants, counts] = await client.view({
  function: `${CONTRACT_ADDRESS}::habit_tracker::get_all_check_ins`,
  arguments: [0, 0],
  type_arguments: []
});

// Display check-in history
weeks.forEach((week, i) => {
  console.log(`Week ${week}: ${participants[i]} checked in ${counts[i]} times`);
});
```

---

### Get Escrow Balance

```move
#[view]
public fun get_escrow_balance(): u64
```

---

### Get Group Commitments Count

```move
#[view]
public fun get_group_commitments_count(group_id: u64): u64
```

---

## Events

### CommitmentCreatedEvent

```move
struct CommitmentCreatedEvent has drop, store {
    commitment_id: u64,
    group_id: u64,
    participant_a: address,
    participant_b: address,
    weekly_payout: u64,
    duration_weeks: u64,
    commitment_name: String,
}
```

### CommitmentAcceptedEvent

```move
struct CommitmentAcceptedEvent has drop, store {
    commitment_id: u64,
    group_id: u64,
    participant_b: address,
}
```

### CheckInEvent

```move
struct CheckInEvent has drop, store {
    commitment_id: u64,
    group_id: u64,
    participant: address,
    week: u64,
    check_in_count: u64,
}
```

### WeekProcessedEvent

```move
struct WeekProcessedEvent has drop, store {
    commitment_id: u64,
    group_id: u64,
    week: u64,
    winner: address,
    payout: u64,
    a_check_ins: u64,
    b_check_ins: u64,
}
```

### FeeCollectedEvent

```move
struct FeeCollectedEvent has drop, store {
    commitment_id: u64,
    participant: address,
    amount: u64,
    fee_amount: u64,
}
```

---

## Complete User Flow

### Week 0: Setup

1. **Alice creates commitment**
   ```typescript
   create_commitment(group=0, bob, 10_USDC, 3_checkins, 4_weeks, "Gym")
   // Alice deposits 20.06 USDC
   ```

2. **Bob accepts**
   ```typescript
   accept_commitment(group=0, commitment=0)
   // Bob deposits 20.06 USDC
   // Total escrow: 40 USDC (after fees)
   ```

### Week 0: During the Week

3. **Monday**: Alice goes to gym
   ```typescript
   check_in(group=0, commitment=0)
   // Alice: 1/3 check-ins
   ```

4. **Wednesday**: Both go to gym
   ```typescript
   // Alice checks in
   check_in(group=0, commitment=0)  // Alice: 2/3
   
   // Bob checks in
   check_in(group=0, commitment=0)  // Bob: 1/3
   ```

5. **Friday**: Alice goes, Bob skips
   ```typescript
   check_in(group=0, commitment=0)  // Alice: 3/3 ✅
   // Bob: 1/3 ❌
   ```

### Week 0: After the Week

6. **Process week results**
   ```typescript
   process_week(group=0, commitment=0, week=0)
   // Alice met requirement (3/3) ✅
   // Bob didn't meet requirement (1/3) ❌
   // Result: Alice wins 10 USDC
   ```

### Week 1: Continue

7. **Repeat for remaining weeks**
   - Check ins reset each week
   - Process each week after it ends
   - Final standings after 4 weeks

### Example Outcomes

**Scenario 1: Alice wins all 4 weeks**
- Alice receives: 40 USDC (all weekly payouts)
- Bob receives: 0 USDC
- Alice profit: +19.94 USDC (after her 20.06 deposit)

**Scenario 2: Each wins 2 weeks**
- Both receive: 20 USDC
- Both break even (minus fees)

**Scenario 3: Both succeed every week**
- Both receive: 20 USDC each (50/50 split × 4 weeks)
- Both break even (minus fees)

---

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1 | `E_ALREADY_INITIALIZED` | Module already initialized |
| 2 | `E_NOT_ADMIN` | Caller is not admin |
| 3 | `E_NOT_INITIALIZED` | Module not initialized |
| 10 | `E_BAD_COMMITMENT_ID` | Invalid commitment ID |
| 11 | `E_NOT_GROUP_MEMBER` | Not a member of the group |
| 12 | `E_INVALID_DURATION` | Duration must be > 0 |
| 13 | `E_INVALID_CHECK_INS_REQUIRED` | Check-ins required must be > 0 |
| 14 | `E_INCORRECT_AMOUNT` | Incorrect USDC amount |
| 15 | `E_NOT_INVITED_PARTICIPANT` | Only invited participant can accept |
| 16 | `E_ALREADY_ACCEPTED` | Commitment already accepted |
| 17 | `E_NOT_ACCEPTED` | Commitment not accepted yet |
| 18 | `E_NOT_CREATOR` | Only creator can delete |
| 19 | `E_CANNOT_DELETE_ACCEPTED` | Cannot delete accepted commitment |
| 20 | `E_NOT_PARTICIPANT` | Not a participant in commitment |
| 21 | `E_WEEK_NOT_ENDED` | Week hasn't ended yet |
| 22 | `E_WEEK_ALREADY_PROCESSED` | Week already processed |
| 23 | `E_INVALID_WEEK` | Invalid week number |
| 24 | `E_COMMITMENT_ENDED` | Commitment duration has ended |
| 25 | `E_CHECK_IN_LIMIT_REACHED` | Weekly check-in limit reached |
| 26 | `E_COMMITMENT_INVALID` | Commitment is invalid/deleted |
| 27 | `E_BOTH_MUST_BE_GROUP_MEMBERS` | Both participants must be in group |

---

## Integration Tips

### Frontend Display

```typescript
// Commitment Card Component
const commitment = await getCommitmentDetails(groupId, commitmentId);
const currentWeek = await getCurrentWeek(groupId, commitmentId);
const aliceCheckins = await getWeeklyCheckIns(groupId, commitmentId, currentWeek, alice);
const bobCheckins = await getWeeklyCheckIns(groupId, commitmentId, currentWeek, bob);

return (
  <Card>
    <h3>{commitment.name}</h3>
    <p>Week {currentWeek + 1} of {commitment.duration_weeks}</p>
    
    <div>
      <User address={alice} />
      <ProgressBar value={aliceCheckins} max={commitment.required_checkins} />
      {aliceCheckins}/{commitment.required_checkins}
    </div>
    
    <div>
      <User address={bob} />
      <ProgressBar value={bobCheckins} max={commitment.required_checkins} />
      {bobCheckins}/{commitment.required_checkins}
    </div>
    
    <Button onClick={checkIn}>Check In</Button>
  </Card>
);
```

### Notifications

```typescript
// Listen for check-in events
contract.events.CheckInEvent.subscribe((event) => {
  if (event.commitment_id === myCommitmentId) {
    notify(`${event.participant} checked in! (${event.check_in_count}/${required})`);
  }
});

// Listen for week processed events
contract.events.WeekProcessedEvent.subscribe((event) => {
  if (event.commitment_id === myCommitmentId) {
    if (event.winner === myAddress) {
      notify(`You won week ${event.week}! +${event.payout} USDC 🎉`);
    } else {
      notify(`You lost week ${event.week}. Stay committed! 💪`);
    }
  }
});
```

### Automatic Week Processing

```typescript
// Cron job or backend service
async function processExpiredWeeks() {
  const commitments = await getAllActiveCommitments();
  
  for (const c of commitments) {
    const currentWeek = await getCurrentWeek(c.group_id, c.id);
    
    for (let week = 0; week < currentWeek; week++) {
      const processed = await isWeekProcessed(c.group_id, c.id, week);
      if (!processed) {
        await processWeek(c.group_id, c.id, week);
        console.log(`Processed week ${week} for commitment ${c.id}`);
      }
    }
  }
}

// Run every hour
setInterval(processExpiredWeeks, 3600000);
```

---

## Deployment

### Prerequisites

1. **Initialize Groups Module** (if not already done)
   ```bash
   aptos move run --function-id ${CONTRACT_ADDRESS}::groups::init
   ```

2. **Initialize Habit Tracker Module**
   ```bash
   aptos move run --function-id ${CONTRACT_ADDRESS}::habit_tracker::init
   ```

### Verification

```bash
# Check escrow balance
aptos move view --function-id ${CONTRACT_ADDRESS}::habit_tracker::get_escrow_balance

# Check commitments count in a group
aptos move view --function-id ${CONTRACT_ADDRESS}::habit_tracker::get_group_commitments_count \
  --args u64:0
```

---

## Testing

All 33 tests passing:
```bash
cd move_contracts && aptos move test
```

Test coverage includes:
- ✅ Commitment creation and validation
- ✅ Acceptance and deletion flows
- ✅ Check-in tracking across multiple weeks
- ✅ Week processing and payout logic
- ✅ Group membership validation
- ✅ Time-based week calculations
- ✅ Edge cases (zero check-ins, limits, etc.)

---

## Security Considerations

1. **Group Verification**: Both participants must be in the same group
2. **Time-based Logic**: Uses `timestamp::now_seconds()` for week calculations
3. **Check-in Limits**: Cannot exceed weekly limit to prevent gaming
4. **One-time Processing**: Each week can only be processed once
5. **Escrow Safety**: All funds held in contract-controlled escrow
6. **Fee Transparency**: 0.3% fee clearly documented and enforced

---

## Future Enhancements

Potential features for v2:
- Support for more than 2 participants
- Variable stakes per week
- Streak bonuses
- Custom success criteria (beyond just check-in count)
- Proof-of-work attachments (photos, GPS, etc.)
- Social features (comments, encouragement messages)
- Leaderboards within groups
- Recurring commitments (auto-renew)

---

## Support

For questions or issues:
- Check test files: `tests/habit_tracker_tests.move`
- Review source code: `sources/habit_tracker.move`
- Contact: [Your contact info]

---

**Last Updated**: December 21, 2024  
**Module Version**: 1.0.0  
**Status**: Production Ready ✅

