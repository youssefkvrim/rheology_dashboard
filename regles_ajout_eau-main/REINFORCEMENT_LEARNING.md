# Reinforcement Learning Implementation Roadmap

This document describes how to implement a Reinforcement Learning (RL) controller
for the barbotine water-addition system, replacing or augmenting the rule-based
27-scenario table.

---

## 1. Why RL Fits This Problem

The barbotine control problem maps naturally to an RL formulation:

- **Continuous state space**: density, viscosity, covering power, temperature,
  current flow rate, time features, trend slopes.
- **Continuous action space**: flow delta in [-0.002, +0.002] L/h.
- **Delayed reward**: the effect of a flow adjustment is only observable 1-6 hours
  later via subsequent rheological measurements.
- **Non-stationary dynamics**: raw material batches change, equipment ages, seasonal
  temperature shifts. A static rule table cannot track these drifts. RL adapts.

The rule-based system serves as the safety baseline. RL operates within its bounds.

---

## 2. MDP Formulation

### State (s_t)

```
s_t = [
    density_72h_avg,
    viscosity_72h_avg,
    covering_power_72h_avg,
    temperature_72h_avg,        # nullable -> impute with 20.0 if missing
    current_flow_rate,
    density_trend_slope,        # linear regression slope over 72h
    viscosity_trend_slope,
    covering_power_trend_slope,
    hour_of_day (sin/cos encoded),
    day_of_week (sin/cos encoded),
    hours_since_last_adjustment,
    cumulative_delta_24h,       # safety budget consumed
]
```

Dimension: 14 continuous features after encoding.

### Action (a_t)

Continuous scalar: flow rate delta in [-MAX_DELTA, +MAX_DELTA].
Clipped post-policy to respect daily budget and doser constraints.

### Reward (r_t)

Computed after EVALUATION_WINDOW_HOURS (default 24h):

```python
def compute_reward(pre_status: StatusTriplet, post_status: StatusTriplet,
                   pre_confidence: ConfidenceScore, post_confidence: ConfidenceScore,
                   action_magnitude: float) -> float:
    conformity_improvement = pre_confidence.severity - post_confidence.severity
    action_penalty = -0.1 * abs(action_magnitude)  # penalize large swings
    stability_bonus = 0.5 if post_status.deviation_count == 0 else 0.0

    return conformity_improvement + action_penalty + stability_bonus
```

Key properties:
- Positive reward for moving toward conform.
- Penalty for unnecessary large actions (encourages smooth control).
- Bonus for reaching full conformity.
- Negative reward for overcorrection.

### Transition Dynamics

Not modeled explicitly. The RL agent learns the dynamics from experience.
For offline pre-training, a dynamics model can be fit from historical data
(see Section 5).

---

## 3. Recommended Algorithm: Soft Actor-Critic (SAC)

**Why SAC over PPO for this use case:**

| Criterion | PPO | SAC |
|-----------|-----|-----|
| Sample efficiency | Low (on-policy) | High (off-policy, replay buffer) |
| Continuous actions | Supported | Native, excels |
| Exploration | Entropy bonus (tuning) | Automatic entropy tuning |
| Stability | Good | Excellent for continuous control |
| Industrial control fit | Adequate | Strong |

SAC is preferred because:
1. **Sample efficiency matters**: each "sample" costs real production time and
   material. Off-policy learning reuses all historical data.
2. **Automatic entropy tuning**: the agent balances exploration/exploitation without
   manual temperature scheduling.
3. **Continuous action space**: SAC natively outputs continuous deltas. PPO can too,
   but SAC's reparameterization trick gives smoother gradients.

---

## 4. Recommended Tools (Open Source, 2024-2026)

### Primary: TorchRL (PyTorch ecosystem)

- **Repository**: https://github.com/pytorch/rl
- **Version**: >= 0.5 (2024+), actively maintained by Meta/PyTorch team.
- **Why**: Native PyTorch integration, modular design, built-in SAC implementation,
  excellent custom environment support, good documentation.
- **License**: MIT

```bash
pip install torchrl tensordict
```

### Environment Definition: Gymnasium

- **Repository**: https://github.com/Farama-Foundation/Gymnasium
- **Version**: >= 1.0 (2024+)
- **Why**: Standard interface for RL environments. TorchRL has native Gymnasium
  wrapper. All RL libraries support it.

```bash
pip install gymnasium
```

### Alternative: Stable-Baselines3

- **Repository**: https://github.com/DLR-RM/stable-baselines3
- **Version**: >= 2.3 (2024+)
- **Why**: Most mature, well-documented, battle-tested SAC implementation.
  Easier learning curve than TorchRL. Good for rapid prototyping.

```bash
pip install stable-baselines3[extra]
```

### Monitoring: Weights & Biases or TensorBoard

```bash
pip install wandb  # or tensorboard
```

### Recommendation

Start with **Stable-Baselines3** for prototyping (faster to get results).
Migrate to **TorchRL** for production (more control, better integration with
custom training loops and deployment).

---

## 5. Implementation Plan

### Phase 1: Data Collection (0-6 months, already started)

**No code changes needed beyond current system.**

1. Continue recording measurements with temperature.
2. Confirm all adjustments (proposed vs actual).
3. The evaluator module auto-generates ActionOutcome records.
4. Target: minimum 500 confirmed adjustments with outcomes per barbotine type.

Data schema already supports this. Every field needed for RL training is logged.

### Phase 2: Offline Dynamics Model (month 6-8)

Build a transition model from historical data to enable offline RL pre-training.

```python
# Simplified dynamics model
import torch
import torch.nn as nn

class BarbotineDynamics(nn.Module):
    """Predicts next rheological state given current state + action."""

    def __init__(self, state_dim: int = 14, action_dim: int = 1, hidden: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim + action_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, state_dim),
        )

    def forward(self, state: torch.Tensor, action: torch.Tensor) -> torch.Tensor:
        x = torch.cat([state, action], dim=-1)
        return self.net(x)
```

Train on historical (state, action, next_state) tuples.
Validate with held-out data. If prediction error < 10% on key properties, proceed.

### Phase 3: Gymnasium Environment (month 8-9)

```python
import gymnasium as gym
import numpy as np

class BarbotineEnv(gym.Env):
    """
    Custom Gymnasium environment wrapping the barbotine control system.
    Can run in simulation mode (using dynamics model) or live mode (using real DB).
    """

    def __init__(self, barbotine_type: str = "M7", mode: str = "simulation"):
        super().__init__()
        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(14,), dtype=np.float32
        )
        self.action_space = gym.spaces.Box(
            low=-0.002, high=0.002, shape=(1,), dtype=np.float32
        )
        self.mode = mode
        # ... load dynamics model or connect to live DB

    def reset(self, seed=None, options=None):
        # Initialize from a random historical state
        state = self._sample_initial_state()
        return state, {}

    def step(self, action):
        # Apply action (clipped to safety bounds)
        clipped = np.clip(action, -0.002, 0.002)

        if self.mode == "simulation":
            next_state = self.dynamics_model.predict(self.state, clipped)
        else:
            # Live: apply adjustment and wait for next measurement
            raise NotImplementedError("Live mode requires async stepping")

        reward = self._compute_reward(self.state, next_state, clipped)
        self.state = next_state
        terminated = False  # continuous process
        truncated = self.step_count >= self.max_steps
        return next_state, reward, terminated, truncated, {}
```

### Phase 4: Offline Pre-Training (month 9-10)

Train SAC agent entirely in simulation first.

```python
from stable_baselines3 import SAC

env = BarbotineEnv(barbotine_type="M7", mode="simulation")

model = SAC(
    "MlpPolicy",
    env,
    learning_rate=3e-4,
    buffer_size=100_000,
    batch_size=256,
    tau=0.005,
    gamma=0.99,
    verbose=1,
    tensorboard_log="./logs/",
)

model.learn(total_timesteps=500_000)
model.save("sac_barbotine_m7_v1")
```

### Phase 5: Shadow Mode Deployment (month 10-12)

Run the RL agent alongside the rule-based system. Both produce recommendations.
Only the rule-based system's decision is applied. The RL recommendation is logged
for comparison.

```python
# In the decide pipeline:
rule_decision = resolve_scenario(status)
rl_action = rl_model.predict(state_vector)

log.info("Rule: %s | RL: %+.4f L/h", rule_decision, rl_action)
# Store both for later analysis
```

Compare after 1 month:
- How often do they agree?
- When they disagree, which would have produced a better outcome?
- Does the RL agent avoid oscillation better?

### Phase 6: Gradual Handover (month 12+)

If shadow mode results are positive:

1. **Conservative blend**: `final_action = 0.7 * rule_action + 0.3 * rl_action`
2. **Increase RL weight** as confidence grows: 0.5/0.5, then 0.7/0.3 RL-dominant.
3. **Full RL with guardrails**: RL is primary, but:
   - Action always clipped to [-MAX_DELTA, +MAX_DELTA]
   - Daily cumulative cap enforced
   - If RL proposes an action that contradicts the rule-based decision direction
     (e.g., RL says decrease but rules say increase), fall back to rules and
     flag for review.

---

## 6. Safety Guardrails (Non-Negotiable)

These apply regardless of RL agent behavior:

1. **Action clipping**: [-0.002, +0.002] L/h per step. Hardware enforced.
2. **Daily budget**: cumulative absolute delta <= 0.048 L/day.
3. **Flow floor**: rate >= 0 L/h (cannot go negative).
4. **Rule-based override**: if the RL agent's proposed action deviates from
   the rule-based direction for 3 consecutive decisions, disable RL and
   revert to rules. Alert operator.
5. **Anomaly detection**: if input state features are outside the training
   distribution (using Mahalanobis distance or isolation forest), fall back
   to rules.
6. **Kill switch**: operator can disable RL at any time via CLI or dashboard.

---

## 7. Monitoring and Retraining

- Log all RL decisions, rewards, and state transitions.
- Dashboard panel: RL vs rule-based decision comparison chart.
- Retrain periodically (monthly) on accumulated data.
- Track reward moving average: if it degrades, auto-switch to rules.

---

## 8. Hardware and Compute Requirements

The model is small (2-layer MLP, ~10K parameters). No GPU needed.

- Training: any machine with Python 3.10+, 4GB RAM. ~30 min for 500K steps.
- Inference: <1ms per prediction. Runs on the same machine as the control system.
- Storage: replay buffer ~50MB for 100K transitions.

---

## 9. Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Data collection | 0-6 months | 500+ confirmed outcomes per type |
| Dynamics model | Month 6-8 | Validated transition predictor |
| Gymnasium env | Month 8-9 | Simulation environment |
| Offline training | Month 9-10 | Trained SAC agent |
| Shadow mode | Month 10-12 | Comparison analysis |
| Gradual handover | Month 12+ | RL-primary with safety guardrails |

Total time to RL-primary: ~12 months from first data collection.
Current system is already collecting the required data.

---

*This roadmap assumes continuous operation. Adjust timelines if production is
intermittent or if data collection is slower than expected.*
