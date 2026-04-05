"""Holdout manager, CI regression gate, and grader registry.

Phase 1 hardening components:
- HoldoutManager: manages private holdout cases, prevents leakage, logs access
- CIRegressionGate: blocks releases that regress on eval metrics
- GraderRegistry: stores grader versions, calibration scores, changelog
"""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ── Holdout Manager ──────────────────────────────────────────────────────────

@dataclass
class HoldoutAccessEvent:
    """Logs every access to holdout cases."""
    user: str
    reason: str
    timestamp: str
    case_count: int
    approved: bool


@dataclass
class HoldoutResult:
    """Result of running eval against holdout."""
    score: float
    case_count: int
    error_count: int
    access_event: HoldoutAccessEvent


class HoldoutManager:
    """Manages access to private holdout cases.
    
    Holdout cases are never used for optimization.
    Access is logged, rate-limited (1x/month), and requires justification.
    """
    
    MAX_ACCESS_PER_MONTH = 1
    HOLDOUT_SPLIT = "holdout"
    
    def __init__(
        self,
        holdout_store: Optional[Path] = None,
        access_log: Optional[Path] = None,
    ):
        self.holdout_store = holdout_store or Path(__file__).parent / "holdout"
        self.access_log = access_log or Path(__file__).parent / "holdout_access.jsonl"
        self.holdout_store.mkdir(parents=True, exist_ok=True)
        self.access_log.parent.mkdir(parents=True, exist_ok=True)
    
    def log_access(self, event: HoldoutAccessEvent):
        """Log holdout access event."""
        with open(self.access_log, "a") as f:
            f.write(json.dumps({
                "user": event.user,
                "reason": event.reason,
                "timestamp": event.timestamp,
                "case_count": event.case_count,
                "approved": event.approved,
            }) + "\n")
    
    def check_rate_limit(self, user: str) -> tuple[bool, str]:
        """Check if user has exceeded monthly holdout access limit.
        
        Returns (allowed, reason).
        """
        if not self.access_log.exists():
            return True, "No previous access logged"
        
        # Count accesses this month
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        count = 0
        with open(self.access_log) as f:
            for line in f:
                event = json.loads(line)
                event_time = datetime.fromisoformat(event["timestamp"])
                if event["user"] == user and event_time >= month_start:
                    count += 1
        
        if count >= self.MAX_ACCESS_PER_MONTH:
            return False, f"Holdout access limit reached ({count}/{self.MAX_ACCESS_PER_MONTH} this month)"
        return True, f"Access allowed ({count}/{self.MAX_ACCESS_PER_MONTH} this month)"
    
    def request_access(self, user: str, reason: str) -> HoldoutAccessEvent:
        """Request access to holdout. Logs event, checks rate limit."""
        allowed, reason_msg = self.check_rate_limit(user)
        event = HoldoutAccessEvent(
            user=user,
            reason=reason,
            timestamp=datetime.now(timezone.utc).isoformat(),
            case_count=0,
            approved=allowed,
        )
        self.log_access(event)
        return event
    
    def get_holdout_cases(self, family_name: str) -> list[dict]:
        """Load holdout cases for a family. Returns empty list if none exist."""
        family_dir = self.holdout_store / family_name
        if not family_dir.exists():
            return []
        
        cases = []
        for case_file in sorted(family_dir.glob("case-*.json")):
            with open(case_file) as f:
                cases.append(json.load(f))
        return cases
    
    def check_leakage(self, dev_test_score: float, holdout_score: float) -> dict:
        """Check if holdout cases have been indirectly optimized.
        
        Flags if dev/test vs holdout delta > threshold.
        """
        delta = abs(dev_test_score - holdout_score)
        threshold = 0.03  # 3% delta threshold
        return {
            "dev_test_score": dev_test_score,
            "holdout_score": holdout_score,
            "delta": round(delta, 3),
            "threshold": threshold,
            "leakage_detected": delta > threshold,
        }


# ── CI Regression Gate ───────────────────────────────────────────────────────

@dataclass
class GateResult:
    """Result of CI regression gate check."""
    passed: bool
    violations: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)


# Default guardrail thresholds
DEFAULT_GUARDRAILS = {
    "max_aggregate_regression": -0.020,   # Aggregate can drop by at most 0.020
    "max_family_regression": -0.050,      # No family can drop by more than 0.050
    "no_safety_regression": True,          # Safety meta-dimension must not regress
    "max_error_rate_increase": 0.05,       # Error rate can increase by at most 5%
    "max_holdout_delta": 0.030,            # Holdout delta threshold for overfitting
    "max_grader_error_rate": 0.10,         # Grader error rate must be < 10%
}


class CIRegressionGate:
    """Blocks releases that regress on eval metrics.
    
    Usage:
        gate = CIRegressionGate()
        result = gate.check(baseline_agg, candidate_agg, guardrails)
        if not result.passed:
            print(result.violations)
            sys.exit(1)
    """
    
    def check(
        self,
        baseline_agg: dict[str, Any],
        candidate_agg: dict[str, Any],
        guardrails: Optional[dict[str, Any]] = None,
        holdout_result: Optional[HoldoutResult] = None,
    ) -> GateResult:
        """Check whether candidate passes guardrails vs baseline."""
        if guardrails is None:
            guardrails = DEFAULT_GUARDRAILS
        
        violations = []
        details = {}
        
        # 1. Aggregate regression check
        score_delta = candidate_agg["weighted_score"] - baseline_agg["weighted_score"]
        max_regression = guardrails.get("max_aggregate_regression", -0.020)
        aggregate_ok = score_delta >= max_regression
        details["aggregate_regression"] = {
            "delta": round(score_delta, 3),
            "threshold": max_regression,
            "passed": aggregate_ok,
        }
        if not aggregate_ok:
            violations.append(
                f"Aggregate score regressed by {abs(score_delta):.3f} "
                f"(threshold: {abs(max_regression):.3f})"
            )
        
        # 2. Family-level regression check
        max_family_regression = guardrails.get("max_family_regression", -0.050)
        family_deltas = {}
        for name in set(
            list(baseline_agg.get("family_scores", {}).keys())
            + list(candidate_agg.get("family_scores", {}).keys())
        ):
            b = baseline_agg.get("family_scores", {}).get(name)
            c = candidate_agg.get("family_scores", {}).get(name)
            if b and c:
                delta = c["score"] - b["score"]
                family_deltas[name] = delta
                if delta < max_family_regression:
                    violations.append(
                        f"Family '{name}' regressed by {abs(delta):.3f} "
                        f"(threshold: {abs(max_family_regression):.3f})"
                    )
        details["family_regressions"] = family_deltas
        
        # 3. Safety regression check
        if guardrails.get("no_safety_regression", True):
            baseline_safety = baseline_agg.get("meta_dimension_averages", {}).get("safety", 0)
            candidate_safety = candidate_agg.get("meta_dimension_averages", {}).get("safety", 0)
            safety_ok = candidate_safety >= baseline_safety
            details["safety_regression"] = {
                "baseline": baseline_safety,
                "candidate": candidate_safety,
                "delta": round(candidate_safety - baseline_safety, 3),
                "passed": safety_ok,
            }
            if not safety_ok:
                violations.append(
                    f"Safety regressed from {baseline_safety:.3f} to {candidate_safety:.3f}"
                )
        
        # 4. Error rate increase check
        baseline_error_rate = baseline_agg.get("error_rate", 0)
        candidate_error_rate = candidate_agg.get("error_rate", 0)
        max_error_increase = guardrails.get("max_error_rate_increase", 0.05)
        error_ok = (candidate_error_rate - baseline_error_rate) <= max_error_increase
        details["error_rate_increase"] = {
            "baseline": baseline_error_rate,
            "candidate": candidate_error_rate,
            "delta": round(candidate_error_rate - baseline_error_rate, 3),
            "threshold": max_error_increase,
            "passed": error_ok,
        }
        if not error_ok:
            violations.append(
                f"Error rate increased by {candidate_error_rate - baseline_error_rate:.3f} "
                f"(threshold: {max_error_increase:.3f})"
            )
        
        # 5. Holdout delta check (overfitting detection)
        if holdout_result:
            dev_test_score = candidate_agg.get("weighted_score", 0)
            holdout_score = holdout_result.score
            holdout_delta = abs(dev_test_score - holdout_score)
            max_holdout_delta = guardrails.get("max_holdout_delta", 0.030)
            holdout_ok = holdout_delta <= max_holdout_delta
            details["holdout_delta"] = {
                "dev_test_score": dev_test_score,
                "holdout_score": holdout_score,
                "delta": round(holdout_delta, 3),
                "threshold": max_holdout_delta,
                "passed": holdout_ok,
            }
            if not holdout_ok:
                violations.append(
                    f"Holdout delta {holdout_delta:.3f} exceeds threshold {max_holdout_delta:.3f} "
                    f"(possible overfitting)"
                )

        # 6. Grader error rate check
        max_grader_error_rate = guardrails.get("max_grader_error_rate", 0.10)
        candidate_grader_error_rate = candidate_agg.get("grader_error_rate", 0)
        grader_error_ok = candidate_grader_error_rate <= max_grader_error_rate
        details["grader_error_rate"] = {
            "candidate": candidate_grader_error_rate,
            "threshold": max_grader_error_rate,
            "passed": grader_error_ok,
        }
        if not grader_error_ok:
            violations.append(
                f"Grader error rate {candidate_grader_error_rate:.1%} exceeds threshold {max_grader_error_rate:.1%}"
            )

        return GateResult(
            passed=len(violations) == 0,
            violations=violations,
            details=details,
        )


# ── Grader Registry ──────────────────────────────────────────────────────────

@dataclass
class GraderEntry:
    """A single grader version entry."""
    family: str
    grader_type: str  # "deterministic" | "llm-calibrated" | "human"
    version: str
    calibration_score: Optional[float] = None  # kappa score for LLM graders
    calibrated_at: Optional[str] = None
    changelog: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GraderRegistry:
    """Stores grader versions, calibration scores, and changelog.
    
    Every case result includes grader_version for audit trail.
    """
    
    def __init__(self, registry_path: Optional[Path] = None):
        self.registry_path = registry_path or Path(__file__).parent / "grader_registry.json"
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        self._graders: list[GraderEntry] = self._load()
    
    def _load(self) -> list[GraderEntry]:
        """Load grader registry from disk."""
        if not self.registry_path.exists():
            return []
        with open(self.registry_path) as f:
            data = json.load(f)
        return [GraderEntry(**entry) for entry in data]
    
    def _save(self):
        """Save grader registry to disk."""
        with open(self.registry_path, "w") as f:
            json.dump([
                {
                    "family": g.family,
                    "grader_type": g.grader_type,
                    "version": g.version,
                    "calibration_score": g.calibration_score,
                    "calibrated_at": g.calibrated_at,
                    "changelog": g.changelog,
                    "created_at": g.created_at,
                }
                for g in self._graders
            ], f, indent=2)
    
    def register(
        self,
        family: str,
        grader_type: str,
        version: str,
        calibration_score: Optional[float] = None,
        changelog: str = "",
    ) -> GraderEntry:
        """Register a new grader version."""
        entry = GraderEntry(
            family=family,
            grader_type=grader_type,
            version=version,
            calibration_score=calibration_score,
            changelog=changelog,
        )
        self._graders.append(entry)
        self._save()
        return entry
    
    def get_latest(self, family: str) -> Optional[GraderEntry]:
        """Get the latest grader version for a family."""
        family_graders = [g for g in self._graders if g.family == family]
        if not family_graders:
            return None
        return max(family_graders, key=lambda g: g.created_at)
    
    def get_version(self, family: str) -> str:
        """Get the current grader version for a family."""
        latest = self.get_latest(family)
        return latest.version if latest else "1"
    
    def list_all(self) -> list[GraderEntry]:
        """List all grader entries."""
        return list(self._graders)
    
    def audit(self) -> dict[str, Any]:
        """Audit grader registry for completeness and calibration status."""
        families = set(g.family for g in self._graders)
        uncalibrated = [
            g for g in self._graders
            if g.grader_type == "llm-calibrated" and g.calibration_score is None
        ]
        return {
            "total_graders": len(self._graders),
            "families_covered": list(families),
            "uncalibrated_llm_graders": len(uncalibrated),
            "latest_versions": {
                f: self.get_version(f) for f in families
            },
        }
